import { MongoServerError, ObjectId, type Db } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { authErrorResponse, getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { ensureSiteIndexes, getMongoClient } from "@/lib/mongodb";
import { readSiteType } from "@/lib/siteTypes";
import type { UpdateHistoryEntry } from "@/lib/updateHistory";

const COLLECTION_NAME = "sites";

interface SiteDocument {
  name: string;
  /** Reference into siteTypes. Null when a site has not been categorised. */
  type: ObjectId | null;
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

export async function GET(request: NextRequest) {
  const authCheck = getAuthenticatedUserId(request);
  if ("error" in authCheck) {
    return authErrorResponse(authCheck);
  }

  try {
    const db = await getDb();

    if (!(await isAdmin(db, authCheck.userId))) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const sites = await db
      .collection<SiteDocument>(COLLECTION_NAME)
      .find()
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({
      sites: sites.map((site) => ({
        _id: site._id.toString(),
        name: site.name,
      })),
    });
  } catch (error) {
    console.error("Failed to load sites:", error);
    return NextResponse.json(
      { error: "Could not load sites. Please try again later." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authCheck = getAuthenticatedUserId(request);
  if ("error" in authCheck) {
    return authErrorResponse(authCheck);
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

    const { name, type } = body as Record<string, unknown>;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) {
      return NextResponse.json(
        { error: "Site name is required." },
        { status: 400 },
      );
    }

    const parsedType = await readSiteType(db, type);
    if ("error" in parsedType) {
      return NextResponse.json({ error: parsedType.error }, { status: 400 });
    }

    await ensureSiteIndexes();

    const collection = db.collection<SiteDocument>(COLLECTION_NAME);
    const existing = await collection.findOne({
      name: { $regex: `^${escapeRegExp(trimmedName)}$`, $options: "i" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A site with that name already exists." },
        { status: 409 },
      );
    }

    const result = await collection.insertOne({
      name: trimmedName,
      type: parsedType.type,
      createdAt: new Date(),
      createdBy: new ObjectId(authCheck.userId),
      updateHistory: [],
    });

    return NextResponse.json(
      {
        _id: result.insertedId.toString(),
        name: trimmedName,
        type: parsedType.type ? parsedType.type.toString() : null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return NextResponse.json(
        { error: "A site with that name already exists." },
        { status: 409 },
      );
    }

    console.error("Failed to add site:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
