import { ObjectId } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import {
  clearAuthCookies,
  getRefreshTokenFromRequest,
  setAccessTokenCookie,
} from "@/lib/authCookies";
import { signAccessToken, verifyRefreshToken } from "@/lib/jwt";
import { getMongoClient } from "@/lib/mongodb";
import { resolveUserTypes } from "@/lib/userTypes";

const COLLECTION_NAME = "users";
const INVALID_TOKEN_MESSAGE = "Invalid or expired refresh token.";

interface UserDocument {
  name: string;
  email: string | null;
  contact: string | null;
  types?: unknown[];
}

export async function POST(request: NextRequest) {
  const refreshToken = getRefreshTokenFromRequest(request);
  if (!refreshToken) {
    return NextResponse.json(
      { error: "Refresh token is required." },
      { status: 400 },
    );
  }

  let userId: string;
  try {
    userId = verifyRefreshToken(refreshToken).sub;
  } catch {
    const response = NextResponse.json(
      { error: INVALID_TOKEN_MESSAGE },
      { status: 401 },
    );
    clearAuthCookies(response);
    return response;
  }

  if (!ObjectId.isValid(userId)) {
    const response = NextResponse.json(
      { error: INVALID_TOKEN_MESSAGE },
      { status: 401 },
    );
    clearAuthCookies(response);
    return response;
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
      const response = NextResponse.json(
        { error: INVALID_TOKEN_MESSAGE },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }

    const types = await resolveUserTypes(db, user.types);

    const accessToken = signAccessToken(userId);

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
    return response;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
