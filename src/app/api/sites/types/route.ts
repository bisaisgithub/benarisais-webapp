import { ObjectId, type Db } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { authErrorResponse, getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { getMongoClient } from "@/lib/mongodb";
import {
  actorIdsOf,
  actorName,
  diffChanges,
  pushUpdateHistory,
  resolveActorNames,
  toHistoryView,
  type UpdateHistoryEntry,
} from "@/lib/updateHistory";

// The user asked for this collection name; the older collections use a
// hyphenated form ("user-types", "time-ranges").
const COLLECTION_NAME = "siteTypes";

interface SiteTypeDocument {
  text: string;
  createdAt?: Date;
  createdBy?: ObjectId | null;
  updateHistory?: UpdateHistoryEntry[];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return process.env.MONGODB_DB
    ? client.db(process.env.MONGODB_DB)
    : client.db();
}

export async function GET(request: NextRequest) {
  const authCheck = getAuthenticatedUserId(request);
  if ("error" in authCheck) {
    return authErrorResponse(authCheck);
  }

  try {
    const db = await getDb();

    if (!(await isAdmin(db, authCheck.userId))) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const types = await db
      .collection<SiteTypeDocument>(COLLECTION_NAME)
      .find()
      .sort({ text: 1 })
      .toArray();

    const actorNames = await resolveActorNames(
      db,
      types.flatMap((type) => actorIdsOf(type)),
    );

    return NextResponse.json({
      types: types.map((type) => ({
        _id: type._id.toString(),
        text: type.text,
        createdByName: actorName(type.createdBy, actorNames),
        createdAt: type.createdAt ? type.createdAt.toISOString() : null,
        history: toHistoryView(type.updateHistory, actorNames),
      })),
    });
  } catch (error) {
    console.error("Failed to load site types:", error);
    return NextResponse.json(
      { error: "Could not load site types. Please try again later." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authCheck = getAuthenticatedUserId(request);
  if ("error" in authCheck) {
    return authErrorResponse(authCheck);
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

    const { text } = body as Record<string, unknown>;
    const trimmedText = typeof text === "string" ? text.trim() : "";

    if (!trimmedText) {
      return NextResponse.json(
        { error: "Type name is required." },
        { status: 400 },
      );
    }

    const collection = db.collection<SiteTypeDocument>(COLLECTION_NAME);
    const existing = await collection.findOne({
      text: { $regex: `^${escapeRegExp(trimmedText)}$`, $options: "i" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "That type already exists." },
        { status: 409 },
      );
    }

    const createdAt = new Date();
    const result = await collection.insertOne({
      text: trimmedText,
      createdAt,
      createdBy: new ObjectId(authCheck.userId),
      updateHistory: [],
    });

    return NextResponse.json(
      {
        _id: result.insertedId.toString(),
        text: trimmedText,
        createdByName: actorName(
          authCheck.userId,
          await resolveActorNames(db, [authCheck.userId]),
        ),
        createdAt: createdAt.toISOString(),
        history: [],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to add site type:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const authCheck = getAuthenticatedUserId(request);
  if ("error" in authCheck) {
    return authErrorResponse(authCheck);
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

    const { id, text } = body as Record<string, unknown>;
    const trimmedText = typeof text === "string" ? text.trim() : "";

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "A valid type id is required." },
        { status: 400 },
      );
    }
    if (!trimmedText) {
      return NextResponse.json(
        { error: "Type name is required." },
        { status: 400 },
      );
    }

    const collection = db.collection<SiteTypeDocument>(COLLECTION_NAME);
    const objectId = new ObjectId(id);

    const existing = await collection.findOne({
      _id: { $ne: objectId },
      text: { $regex: `^${escapeRegExp(trimmedText)}$`, $options: "i" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "That type already exists." },
        { status: 409 },
      );
    }

    const current = await collection.findOne({ _id: objectId });
    if (!current) {
      return NextResponse.json({ error: "Type not found." }, { status: 404 });
    }

    const changes = diffChanges({ text: current.text }, { text: trimmedText });

    await collection.updateOne({ _id: objectId }, {
      $set: { text: trimmedText },
      // Skipped when nothing moved, so a no-op save can't push real edits
      // out of the capped history.
      ...(Object.keys(changes).length > 0
        ? { $push: pushUpdateHistory(authCheck.userId, changes) }
        : {}),
    });

    const updated = await collection.findOne({ _id: objectId });
    const actorNames = await resolveActorNames(
      db,
      updated ? actorIdsOf(updated) : [],
    );

    return NextResponse.json({
      _id: id,
      text: trimmedText,
      createdByName: actorName(updated?.createdBy, actorNames),
      createdAt: updated?.createdAt ? updated.createdAt.toISOString() : null,
      history: toHistoryView(updated?.updateHistory, actorNames),
    });
  } catch (error) {
    console.error("Failed to update site type:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
