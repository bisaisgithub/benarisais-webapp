import { MongoServerError, ObjectId, type Db } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { ensureTimeRangeIndexes, getMongoClient } from "@/lib/mongodb";
import {
  DUPLICATE_MESSAGE,
  readTimeRangeBody,
} from "@/lib/timeRanges";
import type { UpdateHistoryEntry } from "@/lib/updateHistory";

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

    const parsed = readTimeRangeBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await ensureTimeRangeIndexes();

    const collection = db.collection<TimeRangeDocument>(COLLECTION_NAME);

    const existing = await collection.findOne({
      startMinutes: parsed.startMinutes,
      endMinutes: parsed.endMinutes,
    });
    if (existing) {
      return NextResponse.json({ error: DUPLICATE_MESSAGE }, { status: 409 });
    }

    const result = await collection.insertOne({
      ...parsed,
      createdAt: new Date(),
      createdBy: new ObjectId(authCheck.userId),
      updateHistory: [],
    });

    return NextResponse.json(
      { _id: result.insertedId.toString(), ...parsed },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return NextResponse.json({ error: DUPLICATE_MESSAGE }, { status: 409 });
    }

    console.error("Failed to add time range:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
