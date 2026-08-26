import bcrypt from "bcryptjs";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { NextResponse } from "next/server";
import { setAccessTokenCookie, setRefreshTokenCookie } from "@/lib/authCookies";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { getMongoClient } from "@/lib/mongodb";
import { resolveUserTypes } from "@/lib/userTypes";

const COLLECTION_NAME = "users";
const INVALID_CREDENTIALS_MESSAGE = "Invalid email/contact or password.";

interface UserDocument {
  name: string;
  email: string | null;
  contact: string | null;
  password?: string;
  types?: unknown[];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  const { identifier, password } = body as Record<string, unknown>;
  const trimmedIdentifier =
    typeof identifier === "string" ? identifier.trim() : "";
  const suppliedPassword = typeof password === "string" ? password : "";

  if (!trimmedIdentifier || !suppliedPassword) {
    return NextResponse.json(
      { error: "Enter your email or contact number, and your password." },
      { status: 400 },
    );
  }

  try {
    const client = await getMongoClient();
    const db = process.env.MONGODB_DB
      ? client.db(process.env.MONGODB_DB)
      : client.db();
    const collection = db.collection<UserDocument>(COLLECTION_NAME);

    const orConditions: Record<string, unknown>[] = [
      {
        email: {
          $regex: `^${escapeRegExp(trimmedIdentifier)}$`,
          $options: "i",
        },
      },
      { contact: trimmedIdentifier },
    ];
    const parsedPhone = parsePhoneNumberFromString(trimmedIdentifier, "US");
    if (parsedPhone?.isValid()) {
      orConditions.push({ contact: parsedPhone.number });
    }

    const user = await collection.findOne({ $or: orConditions });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: INVALID_CREDENTIALS_MESSAGE },
        { status: 401 },
      );
    }

    const passwordMatches = await bcrypt.compare(
      suppliedPassword,
      user.password,
    );
    if (!passwordMatches) {
      return NextResponse.json(
        { error: INVALID_CREDENTIALS_MESSAGE },
        { status: 401 },
      );
    }

    const userId = user._id.toString();
    const types = await resolveUserTypes(db, user.types);

    const accessToken = signAccessToken(userId);
    const refreshToken = signRefreshToken(userId);

    const response = NextResponse.json({
      user: {
        _id: userId,
        name: user.name,
        email: user.email,
        contact: user.contact,
        types,
      },
    });
    setAccessTokenCookie(response, accessToken);
    setRefreshTokenCookie(response, refreshToken);
    return response;
  } catch (error) {
    console.error("Failed to log in:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
