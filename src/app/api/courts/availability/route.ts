import { ObjectId, type Db } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { getMongoClient } from "@/lib/mongodb";
import {
  durationMinutes,
  findOverlap,
  formatInterval,
  formatTime,
  formatDuration,
  isValidInterval,
  MAX_INTERVAL_HOURS,
  slotFit,
  sortRanges,
  type RangeLike,
} from "@/lib/timeRanges";
import {
  isWeekday,
  sortWeekdays,
  weekdayLabel,
  type Weekday,
} from "@/lib/weekdays";
import {
  pushUpdateHistory,
  type UpdateHistoryEntry,
} from "@/lib/updateHistory";

const MAX_COURTS_PER_SAVE = 500;

interface TimeRangeDocument extends RangeLike {
  interval: number;
}

/** One day's bookable availability: which ranges, and the booking slot size. */
interface AvailabilityEntry {
  day: Weekday;
  times: ObjectId[];
  interval: number;
}

interface CourtDocument {
  siteId: ObjectId;
  number: number;
  availabilityTimes?: AvailabilityEntry[];
  updateHistory?: UpdateHistoryEntry[];
}

async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return process.env.MONGODB_DB
    ? client.db(process.env.MONGODB_DB)
    : client.db();
}

function readIds(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) {
    return null;
  }
  const ids = value.map(String);
  return ids.every((id) => ObjectId.isValid(id)) ? ids : null;
}

/**
 * Sets the availability of one or more courts: the chosen time ranges and
 * booking interval are applied to each chosen day of the week.
 *
 * Replacement is per day. Saving Sunday rewrites Sunday and leaves every
 * other day alone, so a court can be built up a day at a time with different
 * times and intervals on each. Saving a day with no times clears that day.
 *
 * That makes this a read-merge-write per court rather than one blanket $set,
 * since each court's other days are its own. Two admins saving different
 * days of the same court at the same moment could still lose one of the two
 * writes; for an admin tool that is a fair trade for keeping the merge
 * readable.
 */
export async function POST(request: NextRequest) {
  const authCheck = getAuthenticatedUserId(request);
  if ("error" in authCheck) {
    return NextResponse.json(
      { error: authCheck.error },
      { status: authCheck.status },
    );
  }

  try {
    const db = await getDb();

    if (!(await isAdmin(db, authCheck.userId))) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const { courtIds, days, timeRangeIds, interval } = body as Record<
      string,
      unknown
    >;

    const courts = readIds(courtIds, MAX_COURTS_PER_SAVE);
    if (!courts) {
      return NextResponse.json(
        { error: "Select at least one court." },
        { status: 400 },
      );
    }

    const chosenDays = Array.isArray(days) ? [...new Set(days.map(String))] : [];
    if (chosenDays.length === 0 || !chosenDays.every(isWeekday)) {
      return NextResponse.json(
        { error: "Select at least one day of the week." },
        { status: 400 },
      );
    }

    const numericInterval = typeof interval === "number" ? interval : NaN;
    if (!isValidInterval(numericInterval)) {
      return NextResponse.json(
        {
          error: `Booking interval must be 0.5 or a whole number of hours up to ${MAX_INTERVAL_HOURS}.`,
        },
        { status: 400 },
      );
    }

    // An empty selection is allowed: it clears the courts' availability.
    const rangeIds = Array.isArray(timeRangeIds)
      ? timeRangeIds.map(String)
      : null;
    if (!rangeIds || !rangeIds.every((id) => ObjectId.isValid(id))) {
      return NextResponse.json(
        { error: "Select the availability times." },
        { status: 400 },
      );
    }

    const uniqueRangeIds = [...new Set(rangeIds)];
    const ranges = await db
      .collection<TimeRangeDocument>("time-ranges")
      .find({ _id: { $in: uniqueRangeIds.map((id) => new ObjectId(id)) } })
      .toArray();

    if (ranges.length !== uniqueRangeIds.length) {
      return NextResponse.json(
        { error: "One of those time ranges no longer exists." },
        { status: 404 },
      );
    }

    // Re-checked here, not only in the form: the endpoint is reachable
    // directly, and overlapping availability is the thing it must not store.
    const sorted = sortRanges(ranges);
    const clash = findOverlap(sorted);
    if (clash) {
      const [first, second] = clash;
      return NextResponse.json(
        {
          error: `${formatTime(sorted[first].startMinutes)} – ${formatTime(sorted[first].endMinutes)} overlaps ${formatTime(sorted[second].startMinutes)} – ${formatTime(sorted[second].endMinutes)}.`,
        },
        { status: 400 },
      );
    }

    // Each range has to divide exactly into booking slots. 11:00 – 13:30
    // under a 1h interval gives two bookable hours and a trailing 30 minutes
    // nothing could ever book, so the whole setting is refused rather than
    // stored with an unreachable tail.
    const misfit = sorted
      .map((range) => ({ range, fit: slotFit(range, numericInterval) }))
      .find(({ fit }) => fit.remainder > 0);
    if (misfit) {
      const { range, fit } = misfit;
      const span = durationMinutes(range.startMinutes, range.endMinutes);
      return NextResponse.json(
        {
          error: `${formatTime(range.startMinutes)} – ${formatTime(range.endMinutes)} is ${formatDuration(span)}, which does not divide into ${formatInterval(numericInterval)} slots — ${formatDuration(fit.remainder)} would be left over.`,
        },
        { status: 400 },
      );
    }

    const courtObjectIds = courts.map((id) => new ObjectId(id));
    const collection = db.collection<CourtDocument>("courts");
    const existing = await collection
      .find({ _id: { $in: courtObjectIds } })
      .toArray();

    if (existing.length !== courtObjectIds.length) {
      return NextResponse.json(
        { error: "One of those courts no longer exists." },
        { status: 404 },
      );
    }

    // Times ascending within a day; days ordered by WEEKDAYS after merging,
    // so anything reading a court's availability gets it in order.
    const times = sorted.map((range) => range._id);
    const replacedDays = new Set<Weekday>(chosenDays);
    const newEntries: AvailabilityEntry[] =
      times.length === 0
        ? []
        : chosenDays.map((day) => ({ day, times, interval: numericInterval }));

    const rangeLabels = sorted.map(
      (range) =>
        `${formatTime(range.startMinutes)} – ${formatTime(range.endMinutes)}`,
    );
    const labels = chosenDays.map((day) =>
      rangeLabels.length === 0
        ? `${weekdayLabel(day)}: cleared`
        : `${weekdayLabel(day)}: ${rangeLabels.join(", ")} @ ${formatInterval(numericInterval)}`,
    );

    const operations = existing.map((court) => {
      const kept = (court.availabilityTimes ?? []).filter(
        // isWeekday also drops anything left by an earlier shape of this
        // field, rather than carrying it forward unsorted.
        (entry) => isWeekday(entry.day) && !replacedDays.has(entry.day),
      );

      return {
        updateOne: {
          filter: { _id: court._id },
          update: {
            $set: {
              availabilityTimes: sortWeekdays([...kept, ...newEntries]),
            },
            $push: pushUpdateHistory(authCheck.userId, {
              availabilityTimes: labels,
            }),
          },
        },
      };
    });

    const result = await collection.bulkWrite(operations);

    return NextResponse.json({
      updated: result.modifiedCount,
      days: sortWeekdays(chosenDays.map((day) => ({ day }))).map(
        (entry) => entry.day,
      ),
      times: rangeLabels,
      interval: numericInterval,
    });
  } catch (error) {
    console.error("Failed to save court availability:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
