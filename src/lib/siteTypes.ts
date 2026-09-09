import { ObjectId, type Db } from "mongodb";

export const SITE_TYPES_COLLECTION = "siteTypes";

/**
 * Reads the optional site type from a request body. A site may have none —
 * every existing site predates the field — so null is a valid answer, but an
 * id that does not name a real type is not.
 */
export async function readSiteType(
  db: Db,
  value: unknown,
): Promise<{ error: string } | { type: ObjectId | null }> {
  if (value === null || value === undefined || value === "") {
    return { type: null };
  }

  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    return { error: "Select a valid type." };
  }

  const typeId = new ObjectId(value);
  const exists = await db
    .collection(SITE_TYPES_COLLECTION)
    .countDocuments({ _id: typeId }, { limit: 1 });

  return exists === 0
    ? { error: "That type no longer exists." }
    : { type: typeId };
}

/**
 * Type names by id. History records the name rather than the reference, so
 * an edit stays readable after a type is renamed.
 */
export async function siteTypeNames(
  db: Db,
  ids: (ObjectId | null | undefined)[],
): Promise<Map<string, string>> {
  const present = ids.filter((id): id is ObjectId => Boolean(id));
  if (present.length === 0) {
    return new Map();
  }

  const docs = await db
    .collection<{ text: string }>(SITE_TYPES_COLLECTION)
    .find({ _id: { $in: present } })
    .toArray();

  return new Map(docs.map((doc) => [doc._id.toString(), doc.text]));
}
