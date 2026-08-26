import { ObjectId, type Db } from "mongodb";

export interface UserTypeClaim {
  _id: string;
  text: string;
}

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

  return docs.map((doc) => ({ _id: doc._id.toString(), text: doc.text }));
}
