import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getMongoClient } from "@/lib/mongodb";

const COLLECTION_NAME = "user-types";

interface UserTypeDocument {
  text: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getCollection() {
  const client = await getMongoClient();
  const db = process.env.MONGODB_DB
    ? client.db(process.env.MONGODB_DB)
    : client.db();
  return db.collection<UserTypeDocument>(COLLECTION_NAME);
}

export async function GET() {
  try {
    const collection = await getCollection();
    const types = await collection.find().sort({ text: 1 }).toArray();
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

export async function POST(request: Request) {
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

  try {
    const collection = await getCollection();
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

export async function PUT(request: Request) {
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

  try {
    const collection = await getCollection();
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
