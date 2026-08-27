import { ObjectId, type Db } from "mongodb";
import type { NextRequest } from "next/server";
import { getAccessTokenFromRequest } from "@/lib/authCookies";
import { verifyAccessToken } from "@/lib/jwt";

const ADMIN_TYPE_TEXT = "Admin";

export interface AuthCheckResult {
  userId: string;
}

export interface AuthCheckError {
  error: string;
  status: number;
}

/** Verifies an access token only — no database access. */
export function getAuthenticatedUserIdFromToken(
  token: string | null,
): AuthCheckResult | AuthCheckError {
  if (!token) {
    return { error: "Not signed in.", status: 401 };
  }

  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    return { error: "Session expired. Please sign in again.", status: 401 };
  }

  if (!ObjectId.isValid(userId)) {
    return { error: "Session expired. Please sign in again.", status: 401 };
  }

  return { userId };
}

/** Verifies the access token cookie only — no database access. */
export function getAuthenticatedUserId(
  request: NextRequest,
): AuthCheckResult | AuthCheckError {
  return getAuthenticatedUserIdFromToken(getAccessTokenFromRequest(request));
}

/**
 * A user is an admin if their currently active type — types[0], the same
 * value the frontend derives for the "active type" selector — resolves to
 * a user-types document whose text is exactly "Admin".
 */
export async function isAdmin(db: Db, userId: string): Promise<boolean> {
  const user = await db
    .collection<{ types?: unknown[] }>("users")
    .findOne({ _id: new ObjectId(userId) });

  const activeTypeId = user?.types?.[0];
  if (
    activeTypeId === undefined ||
    activeTypeId === null ||
    !ObjectId.isValid(String(activeTypeId))
  ) {
    return false;
  }

  const activeType = await db
    .collection<{ text: string }>("user-types")
    .findOne({ _id: new ObjectId(String(activeTypeId)) });

  return activeType?.text === ADMIN_TYPE_TEXT;
}
