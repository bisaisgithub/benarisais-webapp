import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { signAccessToken, verifyRefreshToken } from "@/lib/jwt";
import { getMongoClient } from "@/lib/mongodb";
import { getActiveType, resolveUserTypes } from "@/lib/userTypes";

const COLLECTION_NAME = "users";
const INVALID_TOKEN_MESSAGE = "Invalid or expired refresh token.";

interface UserDocument {
  name: string;
  email: string | null;
  contact: string | null;
  types?: unknown[];
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

  const { refreshToken } = body as Record<string, unknown>;
  if (typeof refreshToken !== "string" || !refreshToken) {
    return NextResponse.json(
      { error: "Refresh token is required." },
      { status: 400 },
    );
  }

  let userId: string;
  try {
    userId = verifyRefreshToken(refreshToken).sub;
  } catch {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 401 });
  }

  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 401 });
  }

  try {
    const client = await getMongoClient();
    const db = process.env.MONGODB_DB
      ? client.db(process.env.MONGODB_DB)
      : client.db();

    const user = await db
      .collection<UserDocument>(COLLECTION_NAME)
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return NextResponse.json(
        { error: INVALID_TOKEN_MESSAGE },
        { status: 401 },
      );
    }

    const types = await resolveUserTypes(db, user.types);
    const activeType = getActiveType(types);

    const accessToken = signAccessToken(userId);

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
    console.error("Failed to refresh token:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
