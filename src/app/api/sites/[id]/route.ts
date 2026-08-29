import { MongoServerError, ObjectId, type Db } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { ensureSiteIndexes, getMongoClient } from "@/lib/mongodb";
import {
  diffChanges,
  pushUpdateHistory,
  type UpdateHistoryEntry,
} from "@/lib/updateHistory";

const COLLECTION_NAME = "sites";

interface SiteDocument {
  name: string;
  createdAt: Date;
  createdBy: ObjectId | null;
  updateHistory: UpdateHistoryEntry[];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return process.env.MONGODB_DB
    ? client.db(process.env.MONGODB_DB)
    : client.db();
}

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/sites/[id]">,
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
    return NextResponse.json({ error: "Invalid site id." }, { status: 400 });
  }

  try {
    const db = await getDb();

    if (!(await isAdmin(db, authCheck.userId))) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
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

    const { name } = body as Record<string, unknown>;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) {
      return NextResponse.json(
        { error: "Site name is required." },
        { status: 400 },
      );
    }

    await ensureSiteIndexes();

    const collection = db.collection<SiteDocument>(COLLECTION_NAME);
    const objectId = new ObjectId(id);

    const existing = await collection.findOne({
      _id: { $ne: objectId },
      name: { $regex: `^${escapeRegExp(trimmedName)}$`, $options: "i" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A site with that name already exists." },
        { status: 409 },
      );
    }

    const current = await collection.findOne({ _id: objectId });
    if (!current) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }

    const changes = diffChanges(
      { name: current.name },
      { name: trimmedName },
    );

    const result = await collection.updateOne({ _id: objectId }, {
      $set: { name: trimmedName },
      // Skipped when nothing moved, so a no-op save can't push real edits
      // out of the capped history.
      ...(Object.keys(changes).length > 0
        ? { $push: pushUpdateHistory(authCheck.userId, changes) }
        : {}),
    });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }

    return NextResponse.json({ _id: id, name: trimmedName });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return NextResponse.json(
        { error: "A site with that name already exists." },
        { status: 409 },
      );
    }

    console.error("Failed to update site:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
