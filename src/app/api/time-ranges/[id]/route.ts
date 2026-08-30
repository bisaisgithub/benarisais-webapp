import { MongoServerError, ObjectId, type Db } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { ensureTimeRangeIndexes, getMongoClient } from "@/lib/mongodb";
import {
  DUPLICATE_MESSAGE,
  formatTime,
  readTimeRangeBody,
} from "@/lib/timeRanges";
import {
  diffChanges,
  pushUpdateHistory,
  type UpdateHistoryEntry,
} from "@/lib/updateHistory";

const COLLECTION_NAME = "time-ranges";

interface TimeRangeDocument {
  interval: number;
  startMinutes: number;
  endMinutes: number;
  createdAt: Date;
  createdBy: ObjectId | null;
  updateHistory: UpdateHistoryEntry[];
}

async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return process.env.MONGODB_DB
    ? client.db(process.env.MONGODB_DB)
    : client.db();
}

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/time-ranges/[id]">,
) {
  const authCheck = getAuthenticatedUserId(request);
  if ("error" in authCheck) {
    return NextResponse.json(
      { error: authCheck.error },
      { status: authCheck.status },
    );
  }

  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid time range id." },
      { status: 400 },
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

    const parsed = readTimeRangeBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await ensureTimeRangeIndexes();

    const collection = db.collection<TimeRangeDocument>(COLLECTION_NAME);
    const objectId = new ObjectId(id);

    const current = await collection.findOne({ _id: objectId });
    if (!current) {
      return NextResponse.json(
        { error: "Time range not found." },
        { status: 404 },
      );
    }

    const clash = await collection.findOne({
      _id: { $ne: objectId },
      startMinutes: parsed.startMinutes,
      endMinutes: parsed.endMinutes,
    });
    if (clash) {
      return NextResponse.json({ error: DUPLICATE_MESSAGE }, { status: 409 });
    }

    // Times are recorded as they read on screen, so history stays legible.
    const changes = diffChanges(
      {
        interval: current.interval,
        start: formatTime(current.startMinutes),
        end: formatTime(current.endMinutes),
      },
      {
        interval: parsed.interval,
        start: formatTime(parsed.startMinutes),
        end: formatTime(parsed.endMinutes),
      },
    );

    await collection.updateOne({ _id: objectId }, {
      $set: parsed,
      // Skipped when nothing moved, so a no-op save can't push real edits
      // out of the capped history.
      ...(Object.keys(changes).length > 0
        ? { $push: pushUpdateHistory(authCheck.userId, changes) }
        : {}),
    });

    return NextResponse.json({ _id: id, ...parsed });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return NextResponse.json({ error: DUPLICATE_MESSAGE }, { status: 409 });
    }

    console.error("Failed to update time range:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
