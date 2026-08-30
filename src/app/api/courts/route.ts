import {
  MongoServerError,
  ObjectId,
  type Collection,
  type Db,
} from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { ensureCourtIndexes, getMongoClient } from "@/lib/mongodb";
import type { UpdateHistoryEntry } from "@/lib/updateHistory";

const COLLECTION_NAME = "courts";
const MAX_COURTS_PER_ADD = 100;
const MAX_RETRIES = 20;

interface CourtDocument {
  siteId: ObjectId;
  number: number;
  createdAt: Date;
  createdBy: ObjectId | null;
  updateHistory: UpdateHistoryEntry[];
}

async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return process.env.MONGODB_DB
    ? client.db(process.env.MONGODB_DB)
    : client.db();
}

/** The site's highest court number, or 0 when it has none yet. */
async function highestNumber(
  collection: Collection<CourtDocument>,
  siteId: ObjectId,
): Promise<number> {
  const highest = await collection
    .find({ siteId })
    .sort({ number: -1 })
    .limit(1)
    .toArray();

  return highest[0]?.number ?? 0;
}

/**
 * Adds `remaining` courts one at a time, re-reading the highest number after
 * each clash. Used only after a concurrent add breaks the batch insert, so
 * the admin still gets the number of courts they asked for.
 */
async function fillRemaining(
  collection: Collection<CourtDocument>,
  siteId: ObjectId,
  remaining: number,
  createdAt: Date,
  createdBy: ObjectId,
): Promise<number[]> {
  const created: number[] = [];
  let next = await highestNumber(collection, siteId);
  let attempts = 0;

  while (created.length < remaining && attempts < remaining + MAX_RETRIES) {
    attempts++;
    next++;

    try {
      await collection.insertOne({
        siteId,
        number: next,
        createdAt,
        createdBy,
        updateHistory: [],
      });
      created.push(next);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        next = await highestNumber(collection, siteId);
        continue;
      }
      throw error;
    }
  }

  return created;
}



export async function POST(request: NextRequest) {
  const authCheck = getAuthenticatedUserId(request);
  if ("error" in authCheck) {
    return NextResponse.json(
      { error: authCheck.error },
      { status: authCheck.status },
    );
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

    const { siteId, count } = body as Record<string, unknown>;

    if (typeof siteId !== "string" || !ObjectId.isValid(siteId)) {
      return NextResponse.json(
        { error: "Select a site." },
        { status: 400 },
      );
    }

    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > MAX_COURTS_PER_ADD
    ) {
      return NextResponse.json(
        {
          error: `Enter a whole number of courts between 1 and ${MAX_COURTS_PER_ADD}.`,
        },
        { status: 400 },
      );
    }

    const siteObjectId = new ObjectId(siteId);
    const site = await db
      .collection<{ name: string }>("sites")
      .findOne({ _id: siteObjectId });
    if (!site) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }

    await ensureCourtIndexes();

    const collection = db.collection<CourtDocument>(COLLECTION_NAME);

    const lastNumber = await highestNumber(collection, siteObjectId);
    const createdAt = new Date();
    const createdBy = new ObjectId(authCheck.userId);

    // Fast path: one insert for the whole batch, numbering on from the site's
    // highest existing court.
    const planned = Array.from(
      { length: count },
      (_, index) => lastNumber + index + 1,
    );

    let numbers: number[];
    try {
      await collection.insertMany(
        planned.map((number) => ({
          siteId: siteObjectId,
          number,
          createdAt,
          createdBy,
          updateHistory: [],
        })),
        { ordered: true },
      );
      numbers = planned;
    } catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) {
        throw error;
      }

      // A concurrent add took one of those numbers. An ordered insertMany
      // stops at the clash, so some courts may already exist — finish the
      // batch one at a time rather than leaving the admin a partial add.
      const created = await collection
        .find({ siteId: siteObjectId, number: { $gt: lastNumber } })
        .sort({ number: 1 })
        .toArray();

      numbers = created.map((court) => court.number);
      numbers.push(
        ...(await fillRemaining(
          collection,
          siteObjectId,
          count - numbers.length,
          createdAt,
          createdBy,
        )),
      );
      numbers.sort((a, b) => a - b);
    }

    return NextResponse.json(
      { siteId, siteName: site.name, lastNumber, numbers },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to add courts:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
