import { ObjectId, type Db } from "mongodb";
import { getBearerToken, verifyAccessToken } from "@/lib/jwt";

const ADMIN_TYPE_TEXT = "Admin";

export interface AuthCheckResult {
  userId: string;
}

export interface AuthCheckError {
  error: string;
  status: number;
}

/** Verifies the bearer token only — no database access. */
export function getAuthenticatedUserId(
  request: Request,
): AuthCheckResult | AuthCheckError {
  const token = getBearerToken(request);
  if (!token) {
    return { error: "Missing access token.", status: 401 };
  }

  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    return { error: "Invalid or expired access token.", status: 401 };
  }

  if (!ObjectId.isValid(userId)) {
    return { error: "Invalid or expired access token.", status: 401 };
  }

  return { userId };
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
