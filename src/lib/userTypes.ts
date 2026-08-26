import { ObjectId, type Db } from "mongodb";

export interface UserTypeClaim {
  _id: string;
  text: string;
}

/**
 * Resolves a user's `types` ObjectId array into { _id, text } objects,
 * preserving the input order — MongoDB's $in does not guarantee result
 * order matches the query array, and index 0 carries meaning here (it's
 * the user's currently active type).
 */
export async function resolveUserTypes(
  db: Db,
  typeIds: unknown[] | undefined,
): Promise<UserTypeClaim[]> {
  const ids = (typeIds ?? [])
    .map((typeId) => String(typeId))
    .filter((typeId) => ObjectId.isValid(typeId));

  if (ids.length === 0) {
    return [];
  }

  const docs = await db
    .collection<{ text: string }>("user-types")
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
    .toArray();

  const textById = new Map(docs.map((doc) => [doc._id.toString(), doc.text]));

  return ids
    .filter((id) => textById.has(id))
    .map((id) => ({ _id: id, text: textById.get(id)! }));
}

/** The first entry in an (order-preserved) types array is the active type. */
export function getActiveType(types: UserTypeClaim[]): UserTypeClaim | null {
  return types[0] ?? null;
}
