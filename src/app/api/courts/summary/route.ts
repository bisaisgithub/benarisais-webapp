import { type Db } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/authz";
import { getMongoClient } from "@/lib/mongodb";

async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return process.env.MONGODB_DB
    ? client.db(process.env.MONGODB_DB)
    : client.db();
}

/**
 * Every site with the highest court number it currently has, so the add form
 * can show the last number and preview the numbers it would create without a
 * round trip per site the user selects.
 */
export async function GET(request: NextRequest) {
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

    const sites = await db
      .collection<{ name: string }>("sites")
      .find()
      .sort({ name: 1 })
      .toArray();

    const lastNumbers = await db
      .collection("courts")
      .aggregate<{ _id: unknown; lastNumber: number }>([
        { $group: { _id: "$siteId", lastNumber: { $max: "$number" } } },
      ])
      .toArray();

    const lastBySiteId = new Map(
      lastNumbers.map((row) => [String(row._id), row.lastNumber]),
    );

    return NextResponse.json({
      sites: sites.map((site) => ({
        _id: site._id.toString(),
        name: site.name,
        lastNumber: lastBySiteId.get(site._id.toString()) ?? 0,
      })),
    });
  } catch (error) {
    console.error("Failed to load court summary:", error);
    return NextResponse.json(
      { error: "Could not load sites. Please try again later." },
      { status: 500 },
    );
  }
}
