"use client";

import { useListFilters } from "@/components/ListFilters";

export interface FilterField {
  /** URL parameter, and the key the page reads it back under. */
  key: string;
  /** Names the input for screen readers, e.g. "site". */
  label: string;
  placeholder: string;
}

interface TableFiltersProps {
  /**
   * One entry per column *after* the leading No. column, in column order.
   * `null` leaves a column unfilterable — derived values like Duration, or
   * the Actions column — while keeping the row aligned with the headers.
   */
  columns: (FilterField | null)[];
}

/**
 * The filter row under a list table's headers, the way a spreadsheet filters
 * a column. See useUrlFilters for how the values reach the query.
 */
export default function TableFilters({ columns }: TableFiltersProps) {
  const { values, setValue, isPending } = useListFilters();

  // Scoped to this row's own columns: each Clear resets what it shows, so
  // the row's button does not silently wipe the search box above the table.
  const keys = columns
    .filter((column): column is FilterField => column !== null)
    .map((column) => column.key);
  const hasValues = keys.some((key) => (values[key] ?? "").trim());

  function clear() {
    for (const key of keys) {
      setValue(key, "");
    }
  }

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
        {hasValues && (
          <button
            type="button"
            onClick={clear}
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
                onChange={(event) => setValue(column.key, event.target.value)}
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
