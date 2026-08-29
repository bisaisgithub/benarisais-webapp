import { ObjectId, type Db } from "mongodb";

/**
 * How many update entries a document keeps. The $push below slices to the
 * newest MAX_UPDATE_HISTORY, so the oldest entry falls off as a new one
 * arrives rather than the array growing without bound.
 */
export const MAX_UPDATE_HISTORY = 10;

/** One recorded edit. `changes` holds only the fields whose value moved. */
export interface UpdateHistoryEntry {
  updatedBy: ObjectId | null;
  updatedAt: Date;
  changes: Record<string, unknown>;
}

/** An entry ready for the client: ids resolved to names, dates to ISO. */
export interface UpdateHistoryView {
  updatedByName: string;
  updatedAt: string;
  changes: { field: string; value: string }[];
}

const UNKNOWN_ACTOR = "Unknown";

/**
 * Flattens a value to a string so two versions of a field can be compared
 * regardless of type — ObjectIds and Dates included, and arrays element by
 * element so a reordered `types` array reads as a change.
 */
function normalize(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(normalize).join(",");
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * Keeps only the fields of `next` that differ from `current`. An update that
 * changes nothing yields an empty object, which callers use to skip writing
 * a history entry at all — a no-op save must not evict real history from the
 * MAX_UPDATE_HISTORY window.
 */
export function diffChanges(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(next)) {
    if (normalize(current[field]) !== normalize(value)) {
      changes[field] = value;
    }
  }

  return changes;
}

/**
 * The $push operand that appends one entry and trims to the newest
 * MAX_UPDATE_HISTORY. Spread into an update document's `$push`.
 */
export function pushUpdateHistory(
  updatedBy: string,
  changes: Record<string, unknown>,
) {
  const entry: UpdateHistoryEntry = {
    updatedBy: ObjectId.isValid(updatedBy) ? new ObjectId(updatedBy) : null,
    updatedAt: new Date(),
    changes,
  };

  return {
    updateHistory: { $each: [entry], $slice: -MAX_UPDATE_HISTORY },
  };
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.map(String).join(", ");
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/** Looks up display names for a set of user ids in one query. */
export async function resolveActorNames(
  db: Db,
  ids: unknown[],
): Promise<Map<string, string>> {
  const objectIds = ids
    .map((id) => String(id))
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  if (objectIds.length === 0) {
    return new Map();
  }

  const users = await db
    .collection<{ name: string }>("users")
    .find({ _id: { $in: objectIds } })
    .toArray();

  return new Map(users.map((user) => [user._id.toString(), user.name]));
}

/**
 * Resolves one actor id against a name map. A missing id means different
 * things per collection — a self-registered user, or a row created before
 * createdBy existed — so callers name that case with `absentLabel`.
 */
export function actorName(
  actorId: unknown,
  nameById: Map<string, string>,
  absentLabel = UNKNOWN_ACTOR,
): string {
  if (actorId === null || actorId === undefined) {
    return absentLabel;
  }
  return nameById.get(String(actorId)) ?? UNKNOWN_ACTOR;
}

/**
 * Turns stored entries into the shape the history modal renders, newest
 * first. Callers pass a name map built from every actor id on the page so
 * this stays free of per-row queries.
 */
export function toHistoryView(
  entries: UpdateHistoryEntry[] | undefined,
  nameById: Map<string, string>,
): UpdateHistoryView[] {
  return (entries ?? [])
    .map((entry) => ({
      updatedByName: actorName(entry.updatedBy, nameById),
      updatedAt:
        entry.updatedAt instanceof Date
          ? entry.updatedAt.toISOString()
          : String(entry.updatedAt),
      changes: Object.entries(entry.changes ?? {}).map(([field, value]) => ({
        field,
        value: formatValue(value),
      })),
    }))
    .reverse();
}

/** Every actor id referenced by a document, for one batched name lookup. */
export function actorIdsOf(doc: {
  createdBy?: unknown;
  updateHistory?: UpdateHistoryEntry[];
}): unknown[] {
  return [
    doc.createdBy,
    ...(doc.updateHistory ?? []).map((entry) => entry.updatedBy),
  ].filter((id) => id !== null && id !== undefined);
}
