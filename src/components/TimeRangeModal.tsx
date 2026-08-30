"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  crossesMidnight,
  durationMinutes,
  formatDuration,
  formatInterval,
  formatTime,
  intervalToMinutes,
  INTERVAL_OPTIONS,
  parseTime,
  snapToStep,
  stepMinutesFor,
  validateTimeRange,
} from "@/lib/timeRanges";

export interface TimeRangeValue {
  _id: string;
  interval: number;
  start: string;
  end: string;
}

/** Add when no range is given, edit when one is. The form is the same. */
export default function TimeRangeModal({ range }: { range?: TimeRangeValue }) {
  const router = useRouter();
  const isEdit = Boolean(range);

  const [isOpen, setIsOpen] = useState(false);
  const [interval, setInterval] = useState(String(range?.interval ?? 1));
  const [start, setStart] = useState(range?.start ?? "");
  const [end, setEnd] = useState(range?.end ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function openModal() {
    setInterval(String(range?.interval ?? 1));
    setStart(range?.start ?? "");
    setEnd(range?.end ?? "");
    setSubmitError(null);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
  }

  const numericInterval = Number(interval);
  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);

  const stepMinutes = stepMinutesFor(numericInterval);
  // The step drives the picker; the same rule is enforced on the server.
  const step = stepMinutes * 60;

  /**
   * A time input keeps whatever is typed regardless of its step, so pull the
   * value onto the grid once the field is done being edited.
   */
  function snapField(
    value: string,
    setValue: (next: string) => void,
    gridMinutes = stepMinutes,
  ) {
    const minutes = parseTime(value);
    if (minutes === null || minutes % gridMinutes === 0) {
      return;
    }
    setValue(formatTime(snapToStep(minutes, gridMinutes)));
  }

  function handleIntervalChange(next: string) {
    setInterval(next);
    setSubmitError(null);

    // Switching to a coarser grid can strand times that were fine before.
    const nextGrid = stepMinutesFor(Number(next));
    snapField(start, setStart, nextGrid);
    snapField(end, setEnd, nextGrid);
  }

  // Flagged per field, so an off-grid time is called out before the other
  // field is filled in.
  const offGrid = [startMinutes, endMinutes].some(
    (minutes) => minutes !== null && minutes % stepMinutes !== 0,
  );
  const alignmentError = offGrid
    ? stepMinutes === 30
      ? "With a 30 minute interval, times must be on the hour or half hour."
      : "With a whole hour interval, times must be on the hour."
    : null;

  const validationError =
    alignmentError ??
    (startMinutes === null || endMinutes === null
      ? null
      : validateTimeRange({
          interval: numericInterval,
          startMinutes,
          endMinutes,
        }));

  const span =
    startMinutes !== null && endMinutes !== null && !validationError
      ? durationMinutes(startMinutes, endMinutes)
      : null;
  const overnight =
    startMinutes !== null && endMinutes !== null && !validationError
      ? crossesMidnight(startMinutes, endMinutes)
      : false;
  const slots =
    span !== null && span % intervalToMinutes(numericInterval) === 0
      ? span / intervalToMinutes(numericInterval)
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (startMinutes === null || endMinutes === null) {
      setSubmitError("Enter a start and end time.");
      return;
    }
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(
        isEdit ? `/api/time-ranges/${range!._id}` : "/api/time-ranges",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interval: numericInterval,
            start,
            end,
          }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not save the time range.");
      }

      closeModal();
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Could not save the time range.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label={
          isEdit ? `Edit ${range!.start} to ${range!.end}` : undefined
        }
        className={
          isEdit
            ? "rounded-full border border-foreground/15 px-3 py-1 text-xs font-medium transition-colors hover:bg-foreground/10"
            : "rounded-full bg-accent px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        }
      >
        {isEdit ? "Edit" : "Add"}
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] overflow-y-auto bg-black/50"
            role="presentation"
            onClick={closeModal}
          >
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="time-range-modal-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="time-range-modal-title"
                    className="text-lg font-semibold tracking-tight sm:text-xl"
                  >
                    {isEdit ? "Edit Time Range" : "Add Time Range"}
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Close"
                    className="rounded-full p-1 text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="mt-4 flex flex-col gap-4"
                >
                  <div>
                    <label
                      htmlFor="time-range-interval"
                      className="block text-sm font-medium"
                    >
                      Interval
                    </label>
                    <select
                      id="time-range-interval"
                      value={interval}
                      onChange={(event) =>
                        handleIntervalChange(event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                    >
                      {INTERVAL_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {formatInterval(option)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label
                        htmlFor="time-range-start"
                        className="block text-sm font-medium"
                      >
                        Start time
                      </label>
                      <input
                        id="time-range-start"
                        type="time"
                        step={step}
                        value={start}
                        onChange={(event) => {
                          setStart(event.target.value);
                          setSubmitError(null);
                        }}
                        onBlur={(event) =>
                          snapField(event.target.value, setStart)
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    </div>
                    <div className="flex-1">
                      <label
                        htmlFor="time-range-end"
                        className="block text-sm font-medium"
                      >
                        End time
                      </label>
                      <input
                        id="time-range-end"
                        type="time"
                        step={step}
                        value={end}
                        onChange={(event) => {
                          setEnd(event.target.value);
                          setSubmitError(null);
                        }}
                        onBlur={(event) =>
                          snapField(event.target.value, setEnd)
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-3 text-sm">
                    {validationError ? (
                      <p className="text-red-500">{validationError}</p>
                    ) : span !== null ? (
                      <>
                        <p className="text-foreground/70">
                          Duration:{" "}
                          <span className="font-medium text-foreground">
                            {formatDuration(span)}
                          </span>
                          {overnight ? (
                            <span className="text-foreground/60">
                              {" "}
                              — ends the next day
                            </span>
                          ) : null}
                        </p>
                        {slots !== null && (
                          <p className="mt-1 text-foreground/70">
                            Slots:{" "}
                            <span className="font-medium text-foreground">
                              {slots} × {formatInterval(numericInterval)}
                            </span>
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-foreground/60">
                        Pick a start and end time. A range may end the next
                        day, e.g. 23:30 to 01:00.
                      </p>
                    )}
                  </div>

                  {submitError && (
                    <p className="text-xs text-red-500">{submitError}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-full px-4 py-2 text-sm text-foreground/60 transition-colors hover:bg-foreground/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || Boolean(validationError)}
                      className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
