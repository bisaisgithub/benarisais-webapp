import { isValidPhoneNumber } from "libphonenumber-js";
import { NextResponse } from "next/server";
import { getMongoClient } from "@/lib/mongodb";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DB_NAME = process.env.MONGODB_DB || "benarisais";
const COLLECTION_NAME = "registrations";

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
    const client = await getMongoClient();
    const db = client.db(DB_NAME);
    await db.collection(COLLECTION_NAME).insertOne({
      name: name.trim(),
      email: trimmedEmail || null,
      contact: trimmedContact || null,
      message: message.trim(),
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to save registration:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
