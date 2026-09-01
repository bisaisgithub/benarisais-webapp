export const MINUTES_PER_DAY = 24 * 60;
export const HALF_HOUR_INTERVAL = 0.5;
export const MAX_INTERVAL_HOURS = 24;

/** Offered in the form; the validator accepts any value the rule allows. */
export const INTERVAL_OPTIONS = [0.5, 1, 2, 3, 4, 6, 8, 12, 24];

export interface TimeRangeInput {
  interval: number;
  startMinutes: number;
  endMinutes: number;
}

/** An interval is half an hour, or a whole number of hours up to a day. */
export function isValidInterval(interval: unknown): interval is number {
  if (typeof interval !== "number" || !Number.isFinite(interval)) {
    return false;
  }
  if (interval === HALF_HOUR_INTERVAL) {
    return true;
  }
  return (
    Number.isInteger(interval) && interval >= 1 && interval <= MAX_INTERVAL_HOURS
  );
}

export function intervalToMinutes(interval: number): number {
  return Math.round(interval * 60);
}

/**
 * The grid start and end must sit on. A half-hour interval allows :00 and
 * :30; every other interval is a whole number of hours, so times land on
 * the hour.
 */
export function stepMinutesFor(interval: number): number {
  return interval === HALF_HOUR_INTERVAL ? 30 : 60;
}

/**
 * Rounds a time onto the interval's grid, to the nearest step. A time input's
 * `step` only drives its spinner — a typed 12:02 is kept, and Chromium even
 * reports it as valid — so the value is snapped rather than left off-grid.
 * Rounding past the end of the day wraps to 00:00, which these cyclic ranges
 * treat as the neighbour of 23:59 anyway.
 */
export function snapToStep(totalMinutes: number, step: number): number {
  return (Math.round(totalMinutes / step) * step) % MINUTES_PER_DAY;
}

/** "23:30" -> 1410. Returns null for anything that isn't a HH:MM in range. */
export function parseTime(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

/** 1410 -> "23:30". */
export function formatTime(totalMinutes: number): string {
  const normalized =
    ((Math.round(totalMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Minutes from start to end, wrapping past midnight — a range starting at
 * 23:30 and ending at 01:00 runs 90 minutes into the next day. Equal times
 * give 0, which callers reject: a range has to have length.
 */
export function durationMinutes(
  startMinutes: number,
  endMinutes: number,
): number {
  return (
    ((endMinutes - startMinutes) % MINUTES_PER_DAY + MINUTES_PER_DAY) %
    MINUTES_PER_DAY
  );
}

/** Whether the range runs past midnight into the following day. */
export function crossesMidnight(
  startMinutes: number,
  endMinutes: number,
): boolean {
  return endMinutes <= startMinutes;
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function formatInterval(interval: number): string {
  return interval === HALF_HOUR_INTERVAL ? "30m" : `${interval}h`;
}

/**
 * The one place the rules live, so the form and the API cannot disagree.
 * Returns a message to show the admin, or null when the range is valid.
 */
export function validateTimeRange({
  interval,
  startMinutes,
  endMinutes,
}: TimeRangeInput): string | null {
  if (!isValidInterval(interval)) {
    return `Interval must be ${HALF_HOUR_INTERVAL} or a whole number of hours up to ${MAX_INTERVAL_HOURS}.`;
  }

  for (const value of [startMinutes, endMinutes]) {
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value >= MINUTES_PER_DAY
    ) {
      return "Enter a start and end time.";
    }
  }

  const step = stepMinutesFor(interval);
  if (startMinutes % step !== 0 || endMinutes % step !== 0) {
    return step === 30
      ? "With a 30 minute interval, times must be on the hour or half hour."
      : "With a whole hour interval, times must be on the hour.";
  }

  if (startMinutes === endMinutes) {
    return "Start and end cannot be the same time.";
  }

  const span = durationMinutes(startMinutes, endMinutes);
  const intervalLength = intervalToMinutes(interval);
  if (span < intervalLength) {
    return `The range must be at least one interval long (${formatInterval(interval)}).`;
  }

  return null;
}

export const DUPLICATE_MESSAGE =
  "A time range with that start and end already exists.";

/**
 * Pulls the three fields out of a request body and applies the rules, so
 * POST and PUT cannot drift apart.
 */
export function readTimeRangeBody(
  body: unknown,
): { error: string } | TimeRangeInput {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid request body." };
  }

  const { interval, start, end } = body as Record<string, unknown>;
  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);

  if (startMinutes === null || endMinutes === null) {
    return { error: "Enter a start and end time." };
  }

  const numericInterval = typeof interval === "number" ? interval : NaN;
  const error = validateTimeRange({
    interval: numericInterval,
    startMinutes,
    endMinutes,
  });
  if (error) {
    return { error };
  }

  return { interval: numericInterval, startMinutes, endMinutes };
}

export interface RangeLike {
  startMinutes: number;
  endMinutes: number;
}

/**
 * The minutes a range occupies, as half-open [start, end) segments on a
 * single day. A range that wraps past midnight becomes two segments, which
 * is what lets overlap be compared without special-casing the wrap at every
 * call site.
 */
export function toSegments(range: RangeLike): [number, number][] {
  const { startMinutes, endMinutes } = range;
  if (endMinutes > startMinutes) {
    return [[startMinutes, endMinutes]];
  }
  return [
    [startMinutes, MINUTES_PER_DAY],
    [0, endMinutes],
  ];
}

/**
 * Whether two ranges share any minute. Segments are half-open, so ranges
 * that merely touch — 09:00–10:00 and 10:00–11:00 — do not overlap, which
 * is what makes back-to-back availability slots legal.
 */
export function rangesOverlap(a: RangeLike, b: RangeLike): boolean {
  return toSegments(a).some(([aStart, aEnd]) =>
    toSegments(b).some(
      ([bStart, bEnd]) => aStart < bEnd && bStart < aEnd,
    ),
  );
}

/** The first overlapping pair, as indexes into the list, or null. */
export function findOverlap(ranges: RangeLike[]): [number, number] | null {
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (rangesOverlap(ranges[i], ranges[j])) {
        return [i, j];
      }
    }
  }
  return null;
}

/** Ascending by start, then by end. Ranges that wrap sort by their start. */
export function sortRanges<T extends RangeLike>(ranges: T[]): T[] {
  return [...ranges].sort(
    (a, b) =>
      a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  );
}
