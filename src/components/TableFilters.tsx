"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const DEBOUNCE_MS = 300;

export interface FilterField {
  /** URL parameter, and the key the page reads it back under. */
  key: string;
  /** Names the input for screen readers, e.g. "site". */
  label: string;
  placeholder: string;
}

interface TableFiltersProps {
  basePath: string;
  /**
   * One entry per column *after* the leading No. column, in column order.
   * `null` leaves a column unfilterable — derived values like Duration, or
   * the Actions column — while keeping the row aligned with the headers.
   */
  columns: (FilterField | null)[];
  values: Record<string, string>;
}

/**
 * The filter row under a list table's headers, the way a spreadsheet filters
 * a column.
 *
 * Values live in the URL rather than component state, because the filtering
 * happens in the query: the row count, the page count and the page itself all
 * come back already filtered. A client-side filter could only narrow the rows
 * already fetched, which stops being the right answer as soon as there is a
 * second page. Keeping them in the URL also makes a filtered view shareable
 * and lets it survive a refresh.
 */
export default function TableFilters({
  basePath,
  columns,
  values: initialValues,
}: TableFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState(initialValues);

  // Skip the first run: navigating on mount would undo the incoming URL.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Debounced so a typed word is one request, not one per keystroke.
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(values)) {
        if (value.trim()) {
          params.set(key, value.trim());
        } else {
          params.delete(key);
        }
      }

      // A narrower filter can leave the current page past the end.
      params.delete("page");

      startTransition(() => {
        router.push(`${basePath}?${params.toString()}`, { scroll: false });
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // searchParams is intentionally excluded: it changes as a result of the
    // push below, which would otherwise schedule a second, identical one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, basePath, router]);

  const hasFilters = Object.values(values).some((value) => value.trim());
  const inputClass =
    "w-full rounded-lg border border-foreground/15 bg-transparent px-2 py-1 text-xs font-normal outline-none placeholder:text-foreground/40 focus:border-accent";

  return (
    <tr
      aria-busy={isPending}
      className={`border-b border-foreground/10 transition-opacity ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <th className="px-4 py-2">
        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              setValues((current) =>
                Object.fromEntries(Object.keys(current).map((key) => [key, ""])),
              )
            }
            className="rounded-full px-2 py-1 text-xs font-medium text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            Clear
          </button>
        )}
      </th>

      {columns.map((column, index) => (
        <th key={column ? column.key : `blank-${index}`} className="px-4 py-2">
          {column && (
            <>
              <label htmlFor={`filter-${column.key}`} className="sr-only">
                Filter by {column.label}
              </label>
              <input
                id={`filter-${column.key}`}
                type="search"
                value={values[column.key] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [column.key]: event.target.value,
                  }))
                }
                placeholder={column.placeholder}
                className={inputClass}
              />
            </>
          )}
        </th>
      ))}
    </tr>
  );
}
