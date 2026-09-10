import { ObjectId, type Db } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAccessTokenFromRequest } from "@/lib/authCookies";
import { verifyAccessToken } from "@/lib/jwt";

const ADMIN_TYPE_TEXT = "Admin";

export interface AuthCheckResult {
  userId: string;
}

/**
 * Sent to the client alongside a 401 so it can tell the two apart: an access
 * token that lapsed is worth renewing and retrying, no session at all is not.
 */
export type AuthErrorCode = "token_expired" | "no_session";

export interface AuthCheckError {
  error: string;
  status: number;
  code: AuthErrorCode;
}

/** Verifies an access token only — no database access. */
export function getAuthenticatedUserIdFromToken(
  token: string | null,
): AuthCheckResult | AuthCheckError {
  if (!token) {
    return { error: "Not signed in.", status: 401, code: "no_session" };
  }

  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    return {
      error: "Session expired. Please sign in again.",
      status: 401,
      code: "token_expired",
    };
  }

  if (!ObjectId.isValid(userId)) {
    return {
      error: "Session expired. Please sign in again.",
      status: 401,
      code: "token_expired",
    };
  }

  return { userId };
}

/** Verifies the access token cookie only — no database access. */
export function getAuthenticatedUserId(
  request: NextRequest,
): AuthCheckResult | AuthCheckError {
  return getAuthenticatedUserIdFromToken(getAccessTokenFromRequest(request));
}

/** The 401 an endpoint returns when the access token did not check out. */
export function authErrorResponse(authCheck: AuthCheckError) {
  return NextResponse.json(
    { error: authCheck.error, code: authCheck.code },
    { status: authCheck.status },
  );
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
