import { ObjectId, type Db } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { getMongoClient } from "@/lib/mongodb";
import {
  findOverlap,
  formatTime,
  sortRanges,
  type RangeLike,
} from "@/lib/timeRanges";
import {
  pushUpdateHistory,
  type UpdateHistoryEntry,
} from "@/lib/updateHistory";

const MAX_COURTS_PER_SAVE = 500;

interface TimeRangeDocument extends RangeLike {
  interval: number;
}

interface CourtDocument {
  siteId: ObjectId;
  number: number;
  availabilityTimes?: ObjectId[];
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
 * Sets the availability of one or more courts to the same set of time
 * ranges, in one write.
 *
 * This replaces each selected court's availability rather than adding to it:
 * merging would give every court a different result depending on what it
 * already had, and could produce the overlaps this endpoint exists to
 * prevent.
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

    const { courtIds, timeRangeIds } = body as Record<string, unknown>;

    const courts = readIds(courtIds, MAX_COURTS_PER_SAVE);
    if (!courts) {
      return NextResponse.json(
        { error: "Select at least one court." },
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

    const courtObjectIds = courts.map((id) => new ObjectId(id));
    const collection = db.collection<CourtDocument>("courts");
    const matching = await collection.countDocuments({
      _id: { $in: courtObjectIds },
    });
    if (matching !== courtObjectIds.length) {
      return NextResponse.json(
        { error: "One of those courts no longer exists." },
        { status: 404 },
      );
    }

    // Stored ascending, so anything reading a court's availability gets it
    // in order without having to sort.
    const availabilityTimes = sorted.map((range) => range._id);
    const labels = sorted.map(
      (range) =>
        `${formatTime(range.startMinutes)} – ${formatTime(range.endMinutes)}`,
    );

    const result = await collection.updateMany(
      { _id: { $in: courtObjectIds } },
      {
        $set: { availabilityTimes },
        $push: pushUpdateHistory(authCheck.userId, {
          availabilityTimes: labels.length > 0 ? labels : "none",
        }),
      },
    );

    return NextResponse.json({
      updated: result.modifiedCount,
      availabilityTimes: labels,
    });
  } catch (error) {
    console.error("Failed to save court availability:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
