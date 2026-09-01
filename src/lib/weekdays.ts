/**
 * Stored lowercase and in English rather than as an index or a localised
 * name: an index invites off-by-one arguments about which day starts the
 * week, and a localised name changes meaning with the reader's locale.
 */
export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export function isWeekday(value: unknown): value is Weekday {
  return (
    typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value)
  );
}

export function weekdayLabel(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function weekdayShort(day: Weekday): string {
  return weekdayLabel(day).slice(0, 3);
}

/** Monday first, matching WEEKDAYS, so stored availability reads in order. */
export function sortWeekdays<T extends { day: Weekday }>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day),
  );
}
