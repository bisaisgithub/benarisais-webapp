"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useCourtSelection } from "@/components/CourtSelection";
import {
  durationMinutes,
  findOverlap,
  formatDuration,
  formatInterval,
  INTERVAL_OPTIONS,
  rangesOverlap,
  slotFit,
  sortRanges,
  type RangeLike,
} from "@/lib/timeRanges";
import {
  WEEKDAYS,
  weekdayLabel,
  weekdayShort,
  type Weekday,
} from "@/lib/weekdays";

interface TimeRangeOption extends RangeLike {
  _id: string;
  label: string;
  intervalLabel: string;
}

/**
 * Appears once rows are ticked, and applies one set of availability times to
 * all of them at once.
 */
export default function AddAvailabilityBar() {
  const router = useRouter();
  const { selected, clear, someSelected } = useCourtSelection();

  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<TimeRangeOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [days, setDays] = useState<Weekday[]>([]);
  const [interval, setInterval] = useState("1");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function loadTimeRanges() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/time-ranges");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not load time ranges.");
      }
      setOptions(Array.isArray(data?.timeRanges) ? data.timeRanges : []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load time ranges.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openModal() {
    setChosen([]);
    setDays([]);
    setInterval("1");
    setSaveError(null);
    setIsOpen(true);
    loadTimeRanges();
  }

  const chosenRanges = sortRanges(
    options.filter((option) => chosen.includes(option._id)),
  );
  const clash = findOverlap(chosenRanges);

  const orderedDays = WEEKDAYS.filter((day) => days.includes(day));
  const numericInterval = Number(interval);

  // Each range has to divide exactly into booking slots, or the tail of it
  // could never be booked.
  const fitted = chosenRanges.map((range) => ({
    range,
    fit: slotFit(range, numericInterval),
  }));
  const misfit = fitted.find(({ fit }) => fit.remainder > 0);
  const totalSlots = fitted.reduce((sum, { fit }) => sum + fit.slots, 0);

  /** An option is blocked when it would overlap something already chosen. */
  function blockedBy(option: TimeRangeOption): TimeRangeOption | null {
    if (chosen.includes(option._id)) return null;
    return (
      chosenRanges.find((range) => rangesOverlap(range, option)) ?? null
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (clash) {
      setSaveError("Those availability times overlap.");
      return;
    }
    if (orderedDays.length === 0) {
      setSaveError("Select at least one day of the week.");
      return;
    }
    if (misfit) {
      setSaveError(
        `${misfit.range.label} does not divide into ${formatInterval(numericInterval)} slots.`,
      );
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/courts/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtIds: selected,
          days: orderedDays,
          timeRangeIds: chosenRanges.map((range) => range._id),
          interval: numericInterval,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not save availability.");
      }

      setIsOpen(false);
      clear();
      router.refresh();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save availability.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!someSelected) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3">
      <span className="text-sm">
        <span className="font-medium">{selected.length}</span>{" "}
        {selected.length === 1 ? "court" : "courts"} selected
      </span>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Add availability
      </button>
      <button
        type="button"
        onClick={clear}
        className="rounded-full px-3 py-1.5 text-sm text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        Clear selection
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] overflow-y-auto bg-black/50"
            role="presentation"
            onClick={() => setIsOpen(false)}
          >
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="availability-modal-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-lg rounded-2xl border border-foreground/10 bg-background p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="availability-modal-title"
                    className="text-lg font-semibold tracking-tight sm:text-xl"
                  >
                    Add Availability
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close"
                    className="rounded-full p-1 text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <p className="mt-2 text-sm text-foreground/60">
                  Replaces the availability on the {selected.length}{" "}
                  {selected.length === 1 ? "selected court" : "selected courts"}
                  .
                </p>

                <form onSubmit={handleSubmit} className="mt-4">
                  <fieldset>
                    <legend className="text-sm font-medium">Days</legend>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((day) => {
                        const on = days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              setDays((current) =>
                                current.includes(day)
                                  ? current.filter((other) => other !== day)
                                  : [...current, day],
                              )
                            }
                            aria-pressed={on}
                            aria-label={weekdayLabel(day)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                              on
                                ? "border-accent bg-accent text-background"
                                : "border-foreground/15 hover:bg-foreground/10"
                            }`}
                          >
                            {weekdayShort(day)}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() =>
                          setDays((current) =>
                            current.length === WEEKDAYS.length
                              ? []
                              : [...WEEKDAYS],
                          )
                        }
                        className="rounded-full px-3 py-1 text-xs text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      >
                        {days.length === WEEKDAYS.length ? "None" : "All days"}
                      </button>
                    </div>
                  </fieldset>

                  <fieldset className="mt-4">
                    <legend className="text-sm font-medium">
                      Availability times
                    </legend>

                    <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-foreground/10">
                      {isLoading ? (
                        <p className="py-6 text-center text-sm text-foreground/60">
                          Loading…
                        </p>
                      ) : loadError ? (
                        <p className="py-6 text-center text-sm text-red-500">
                          {loadError}
                        </p>
                      ) : options.length === 0 ? (
                        <p className="py-6 text-center text-sm text-foreground/60">
                          No time ranges yet. Add some first.
                        </p>
                      ) : (
                        <ul className="divide-y divide-foreground/10">
                          {options.map((option) => {
                            const blocker = blockedBy(option);
                            return (
                              <li key={option._id}>
                                <label
                                  className={`flex items-center gap-3 px-3 py-2 text-sm ${
                                    blocker
                                      ? "cursor-not-allowed opacity-40"
                                      : "cursor-pointer hover:bg-foreground/5"
                                  }`}
                                  title={
                                    blocker
                                      ? `Overlaps ${blocker.label}`
                                      : undefined
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    checked={chosen.includes(option._id)}
                                    disabled={Boolean(blocker)}
                                    onChange={() =>
                                      setChosen((current) =>
                                        current.includes(option._id)
                                          ? current.filter(
                                              (id) => id !== option._id,
                                            )
                                          : [...current, option._id],
                                      )
                                    }
                                    className="h-4 w-4 accent-accent"
                                  />
                                  <span className="flex-1">{option.label}</span>
                                  <span className="text-xs text-foreground/50">
                                    {option.intervalLabel}
                                    {blocker ? " · overlaps" : ""}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </fieldset>

                  <div className="mt-4">
                    <label
                      htmlFor="availability-interval"
                      className="block text-sm font-medium"
                    >
                      Booking interval
                    </label>
                    <select
                      id="availability-interval"
                      value={interval}
                      onChange={(event) => setInterval(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                    >
                      {INTERVAL_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {formatInterval(option)}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-foreground/50">
                      How each range is divided into bookable slots.
                    </p>
                  </div>

                  <div className="mt-3 rounded-xl border border-foreground/10 bg-foreground/5 p-3 text-sm">
                    <p className="text-foreground/70">
                      Will save:{" "}
                      <span className="font-medium text-foreground">
                        {chosenRanges.length === 0
                          ? "no availability"
                          : orderedDays.length === 0
                            ? "pick at least one day"
                            : `${orderedDays.map(weekdayShort).join(", ")} · ${chosenRanges
                                .map((range) => range.label)
                                .join(", ")} · ${formatInterval(numericInterval)} slots`}
                      </span>
                    </p>
                    {chosenRanges.length > 0 &&
                      orderedDays.length > 0 &&
                      !misfit && (
                        <p className="mt-1 text-xs text-foreground/50">
                          {totalSlots} bookable{" "}
                          {totalSlots === 1 ? "slot" : "slots"} per day · saved
                          Sunday first, times ascending.
                        </p>
                      )}
                  </div>

                  {clash && (
                    <p className="mt-2 text-xs text-red-500">
                      {chosenRanges[clash[0]].label} overlaps{" "}
                      {chosenRanges[clash[1]].label}.
                    </p>
                  )}
                  {misfit && (
                    <p className="mt-2 text-xs text-red-500">
                      {misfit.range.label} is{" "}
                      {formatDuration(
                        durationMinutes(
                          misfit.range.startMinutes,
                          misfit.range.endMinutes,
                        ),
                      )}
                      , which does not divide into{" "}
                      {formatInterval(numericInterval)} slots —{" "}
                      {formatDuration(misfit.fit.remainder)} would be left
                      over.
                    </p>
                  )}
                  {saveError && (
                    <p className="mt-2 text-xs text-red-500">{saveError}</p>
                  )}

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="rounded-full px-4 py-2 text-sm text-foreground/60 transition-colors hover:bg-foreground/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isSaving ||
                        Boolean(clash) ||
                        Boolean(misfit) ||
                        (chosenRanges.length > 0 && orderedDays.length === 0)
                      }
                      className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? "Saving…" : "Save bulk"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
