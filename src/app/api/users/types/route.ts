import { ObjectId, type Db } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { getMongoClient } from "@/lib/mongodb";

const COLLECTION_NAME = "user-types";

interface UserTypeDocument {
  text: string;
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

export async function GET() {
  try {
    const db = await getDb();
    const types = await db
      .collection<UserTypeDocument>(COLLECTION_NAME)
      .find()
      .sort({ text: 1 })
      .toArray();
    return NextResponse.json({
      types: types.map((type) => ({
        _id: type._id.toString(),
        text: type.text,
      })),
    });
  } catch (error) {
    console.error("Failed to load user types:", error);
    return NextResponse.json(
      { error: "Could not load user types. Please try again later." },
      { status: 500 },
    );
  }
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

    const collection = db.collection<UserTypeDocument>(COLLECTION_NAME);
    const existing = await collection.findOne({
      text: { $regex: `^${escapeRegExp(trimmedText)}$`, $options: "i" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "That type already exists." },
        { status: 409 },
      );
    }

    const result = await collection.insertOne({ text: trimmedText });
    return NextResponse.json(
      { _id: result.insertedId.toString(), text: trimmedText },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to add user type:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const collection = db.collection<UserTypeDocument>(COLLECTION_NAME);
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

    const result = await collection.updateOne(
      { _id: objectId },
      { $set: { text: trimmedText } },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Type not found." }, { status: 404 });
    }

    return NextResponse.json({ _id: id, text: trimmedText });
  } catch (error) {
    console.error("Failed to update user type:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
