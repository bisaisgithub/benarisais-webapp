import { ObjectId, type Db } from "mongodb";

export const SITES_COLLECTION = "sites";

/**
 * Reads a submitted list of site references. Accepts an absent field as "no
 * sites" so a caller that does not manage sites can leave them alone, and
 * checks every id against the collection: an id that no longer exists would
 * otherwise be stored as a reference to nothing.
 */
export async function readSiteIds(
  db: Db,
  value: unknown,
): Promise<{ error: string } | { siteIds: ObjectId[] }> {
  const raw = value === undefined || value === null ? [] : value;

  if (
    !Array.isArray(raw) ||
    !raw.every((id) => typeof id === "string" && ObjectId.isValid(id))
  ) {
    return { error: "One or more selected sites are invalid." };
  }

  // The same site twice would store a duplicate reference and read as two
  // entries everywhere downstream.
  const unique = [...new Set(raw as string[])];
  if (unique.length === 0) {
    return { siteIds: [] };
  }

  const ids = unique.map((id) => new ObjectId(id));
  const found = await db
    .collection(SITES_COLLECTION)
    .countDocuments({ _id: { $in: ids } });

  if (found !== ids.length) {
    return { error: "One or more selected sites no longer exist." };
  }

  return { siteIds: ids };
}

/**
 * Resolves site references to their names, in the order given — `$in` does
 * not preserve the query array's order. Names, not ids, are what belongs in
 * update history, so a rename leaves old entries readable.
 */
export async function resolveSites(
  db: Db,
  siteIds: unknown[] | undefined,
): Promise<{ _id: string; name: string }[]> {
  const ids = (siteIds ?? [])
    .map((siteId) => String(siteId))
    .filter((siteId) => ObjectId.isValid(siteId));

  if (ids.length === 0) {
    return [];
  }

  const docs = await db
    .collection<{ name: string }>(SITES_COLLECTION)
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
    .toArray();

  const nameById = new Map(docs.map((doc) => [doc._id.toString(), doc.name]));

  return ids
    .filter((id) => nameById.has(id))
    .map((id) => ({ _id: id, name: nameById.get(id)! }));
}
