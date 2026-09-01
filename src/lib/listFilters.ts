import { parseTime } from "@/lib/timeRanges";

/**
 * A condition that matches no document. Used when a filter's input cannot be
 * read — a court number of "abc", say. Dropping the filter instead would show
 * rows the reader believes they have excluded, which is worse than an empty
 * table they can see is empty.
 */
export const MATCHES_NOTHING = { $in: [] };

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive substring, the way a spreadsheet's column search reads. */
export function textCondition(raw: string) {
  return { $regex: escapeRegExp(raw), $options: "i" };
}

/** Exact numeric match; accepts 0.5 as well as whole numbers. */
export function numberCondition(raw: string) {
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) ? parsed : MATCHES_NOTHING;
}

/**
 * Matches times stored as minutes from midnight. "09:30" matches exactly;
 * a bare hour like "9" matches everything within that hour, which is what
 * someone scanning a column of times usually means.
 */
export function timeCondition(raw: string) {
  const trimmed = raw.trim();

  if (/^\d{1,2}$/.test(trimmed)) {
    const hour = Number(trimmed);
    if (hour > 23) {
      return MATCHES_NOTHING;
    }
    return { $gte: hour * 60, $lt: hour * 60 + 60 };
  }

  const minutes = parseTime(trimmed);
  return minutes === null ? MATCHES_NOTHING : minutes;
}

/** Reads one filter out of the resolved searchParams. */
export function filterValue(
  value: string | string[] | undefined,
): string {
  return (Array.isArray(value) ? value[0] : (value ?? "")).trim();
}
