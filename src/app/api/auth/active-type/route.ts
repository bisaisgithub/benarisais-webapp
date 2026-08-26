import { ObjectId } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { setAccessTokenCookie } from "@/lib/authCookies";
import { getAuthenticatedUserId } from "@/lib/authz";
import { signAccessToken } from "@/lib/jwt";
import { getMongoClient } from "@/lib/mongodb";
import { resolveUserTypes } from "@/lib/userTypes";

const COLLECTION_NAME = "users";

interface UserDocument {
  name: string;
  email: string | null;
  contact: string | null;
  types?: unknown[];
}

export async function PUT(request: NextRequest) {
  const authCheck = getAuthenticatedUserId(request);
  if ("error" in authCheck) {
    return NextResponse.json(
      { error: authCheck.error },
      { status: authCheck.status },
    );
  }
  const { userId } = authCheck;

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

    // The selected type moves to index 0; the rest keep their relative order.
    const reorderedTypeIds = [
      typeId,
      ...assignedTypeIds.filter((id) => id !== typeId),
    ];

    await collection.updateOne(
      { _id: objectId },
      { $set: { types: reorderedTypeIds.map((id) => new ObjectId(id)) } },
    );

    const types = await resolveUserTypes(db, reorderedTypeIds);

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
    console.error("Failed to switch active type:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
