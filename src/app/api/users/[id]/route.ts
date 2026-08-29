import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import { MongoServerError, ObjectId } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { ensureUserIndexes, getMongoClient } from "@/lib/mongodb";
import {
  diffChanges,
  pushUpdateHistory,
  type UpdateHistoryEntry,
} from "@/lib/updateHistory";
import { resolveUserTypes } from "@/lib/userTypes";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLLECTION_NAME = "users";

interface UserDocument {
  name: string;
  email: string | null;
  contact: string | null;
  message: string;
  types?: ObjectId[];
  password?: string;
  createdAt?: Date;
  createdBy?: ObjectId | null;
  updateHistory?: UpdateHistoryEntry[];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

    await ensureUserIndexes();

    const collection = db.collection<UserDocument>(COLLECTION_NAME);
    const objectId = new ObjectId(id);

    if (trimmedEmail) {
      const existingEmail = await collection.findOne({
        _id: { $ne: objectId },
        email: { $regex: `^${escapeRegExp(trimmedEmail)}$`, $options: "i" },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: "An account with that email already exists." },
          { status: 409 },
        );
      }
    }

    if (trimmedContact) {
      const contactConditions: Record<string, unknown>[] = [
        { contact: trimmedContact },
      ];
      const parsedPhone = parsePhoneNumberFromString(trimmedContact, "US");
      if (parsedPhone?.isValid() && parsedPhone.number !== trimmedContact) {
        contactConditions.push({ contact: parsedPhone.number });
      }
      const existingContact = await collection.findOne({
        _id: { $ne: objectId },
        $or: contactConditions,
      });
      if (existingContact) {
        return NextResponse.json(
          { error: "An account with that contact number already exists." },
          { status: 409 },
        );
      }
    }

    const current = await collection.findOne({ _id: objectId });
    if (!current) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Types are recorded by their text rather than their id, so history stays
    // readable even after a type is renamed.
    const [currentTypeTexts, nextTypeTexts] = await Promise.all([
      resolveUserTypes(db, current.types),
      resolveUserTypes(db, typeIds),
    ]);

    const changes = diffChanges(
      {
        name: current.name,
        email: current.email,
        contact: current.contact,
        message: current.message,
        types: currentTypeTexts.map((type) => type.text),
      },
      {
        name: name.trim(),
        email: trimmedEmail || null,
        contact: trimmedContact || null,
        message: message.trim(),
        types: nextTypeTexts.map((type) => type.text),
      },
    );

    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      {
        $set: {
          name: name.trim(),
          email: trimmedEmail || null,
          contact: trimmedContact || null,
          message: message.trim(),
          types: typeIds.map((typeId: string) => new ObjectId(typeId)),
        },
        // Skipped when nothing moved, so a no-op save can't push real edits
        // out of the capped history.
        ...(Object.keys(changes).length > 0
          ? { $push: pushUpdateHistory(authCheck.userId, changes) }
          : {}),
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
    if (error instanceof MongoServerError && error.code === 11000) {
      const duplicateField = error.keyPattern?.contact
        ? "contact number"
        : "email";
      return NextResponse.json(
        { error: `An account with that ${duplicateField} already exists.` },
        { status: 409 },
      );
    }

    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
