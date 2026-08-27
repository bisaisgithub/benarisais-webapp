import { isValidPhoneNumber } from "libphonenumber-js";
import { ObjectId } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { getMongoClient } from "@/lib/mongodb";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLLECTION_NAME = "users";

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/users/[id]">,
) {
  const authCheck = getAuthenticatedUserId(request);
  if ("error" in authCheck) {
    return NextResponse.json(
      { error: authCheck.error },
      { status: authCheck.status },
    );
  }

  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
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

  const { name, email, contact, message, types } = body as Record<
    string,
    unknown
  >;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "Message is required." },
      { status: 400 },
    );
  }

  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  const trimmedContact = typeof contact === "string" ? contact.trim() : "";

  if (!trimmedEmail && !trimmedContact) {
    return NextResponse.json(
      { error: "Provide an email address or a contact number." },
      { status: 400 },
    );
  }
  if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (trimmedContact && !isValidPhoneNumber(trimmedContact)) {
    return NextResponse.json(
      { error: "Enter a valid phone number, including country code." },
      { status: 400 },
    );
  }

  const typeIds = types === undefined ? [] : types;
  if (
    !Array.isArray(typeIds) ||
    !typeIds.every(
      (typeId) => typeof typeId === "string" && ObjectId.isValid(typeId),
    )
  ) {
    return NextResponse.json(
      { error: "One or more selected types are invalid." },
      { status: 400 },
    );
  }

  try {
    const client = await getMongoClient();
    const db = process.env.MONGODB_DB
      ? client.db(process.env.MONGODB_DB)
      : client.db();

    if (!(await isAdmin(db, authCheck.userId))) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          name: name.trim(),
          email: trimmedEmail || null,
          contact: trimmedContact || null,
          message: message.trim(),
          types: typeIds.map((typeId: string) => new ObjectId(typeId)),
        },
      },
      { returnDocument: "after" },
    );

    if (!result) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      _id: result._id.toString(),
      name: result.name,
      email: result.email,
      contact: result.contact,
      message: result.message,
      types: (result.types ?? []).map((typeId: ObjectId) => typeId.toString()),
    });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
