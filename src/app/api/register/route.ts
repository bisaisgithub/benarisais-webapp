import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";
import { ensureUserIndexes, getMongoClient } from "@/lib/mongodb";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLLECTION_NAME = "users";

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

  const { name, email, contact, message } = body as Record<string, unknown>;

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

  try {
    await ensureUserIndexes();

    const client = await getMongoClient();
    const db = process.env.MONGODB_DB
      ? client.db(process.env.MONGODB_DB)
      : client.db();
    const collection = db.collection(COLLECTION_NAME);

    if (trimmedEmail) {
      const existingEmail = await collection.findOne({
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
        $or: contactConditions,
      });
      if (existingContact) {
        return NextResponse.json(
          { error: "An account with that contact number already exists." },
          { status: 409 },
        );
      }
    }

    await collection.insertOne({
      name: name.trim(),
      email: trimmedEmail || null,
      contact: trimmedContact || null,
      message: message.trim(),
      createdAt: new Date(),
      // Registration is public and unauthenticated, so there is no actor to
      // credit — null reads as self-registered wherever history is shown.
      createdBy: null,
      updateHistory: [],
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

    console.error("Failed to save registration:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
