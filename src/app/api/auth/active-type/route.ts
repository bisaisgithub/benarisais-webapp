import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getBearerToken, signAccessToken, verifyAccessToken } from "@/lib/jwt";
import { getMongoClient } from "@/lib/mongodb";
import { resolveUserTypes } from "@/lib/userTypes";

const COLLECTION_NAME = "users";

interface UserDocument {
  name: string;
  email: string | null;
  contact: string | null;
  types?: unknown[];
}

export async function PUT(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing access token." },
      { status: 401 },
    );
  }

  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired access token." },
      { status: 401 },
    );
  }

  if (!ObjectId.isValid(userId)) {
    return NextResponse.json(
      { error: "Invalid or expired access token." },
      { status: 401 },
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

  const { typeId } = body as Record<string, unknown>;
  if (typeof typeId !== "string" || !ObjectId.isValid(typeId)) {
    return NextResponse.json(
      { error: "A valid type id is required." },
      { status: 400 },
    );
  }

  try {
    const client = await getMongoClient();
    const db = process.env.MONGODB_DB
      ? client.db(process.env.MONGODB_DB)
      : client.db();
    const collection = db.collection<UserDocument>(COLLECTION_NAME);
    const objectId = new ObjectId(userId);

    const user = await collection.findOne({ _id: objectId });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const assignedTypeIds = (user.types ?? []).map((id) => String(id));
    if (!assignedTypeIds.includes(typeId)) {
      return NextResponse.json(
        { error: "That type is not assigned to your account." },
        { status: 403 },
      );
    }

    await collection.updateOne(
      { _id: objectId },
      { $set: { activeType: new ObjectId(typeId) } },
    );

    const types = await resolveUserTypes(db, user.types);
    const activeType = types.find((type) => type._id === typeId) ?? null;

    const accessToken = signAccessToken({
      sub: userId,
      name: user.name,
      email: user.email,
      contact: user.contact,
      types,
      activeType,
    });

    return NextResponse.json({
      accessToken,
      user: {
        _id: userId,
        name: user.name,
        email: user.email,
        contact: user.contact,
        types,
        activeType,
      },
    });
  } catch (error) {
    console.error("Failed to switch active type:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
