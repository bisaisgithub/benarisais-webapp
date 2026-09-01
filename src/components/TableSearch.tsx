"use client";

import { useListFilters } from "@/components/ListFilters";

interface TableSearchProps {
  placeholder?: string;
}

/**
 * One box that searches every field at once, for when you know a fragment of
 * something but not which column it sits in. It narrows the same query the
 * column filters do, so the two combine: search finds the rows, a column
 * filter narrows them further.
 */
export default function TableSearch({
  placeholder = "Search all fields…",
}: TableSearchProps) {
  const { values, setValue, isPending } = useListFilters();
  const value = values.q ?? "";

  return (
    <div className="relative mt-6 max-w-md" aria-busy={isPending}>
      <label htmlFor="table-search" className="sr-only">
        {placeholder}
      </label>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>

      <input
        id="table-search"
        type="search"
        value={value}
        onChange={(event) => setValue("q", event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-full border border-foreground/15 bg-transparent py-2 pl-9 text-sm outline-none transition-opacity placeholder:text-foreground/40 focus:border-accent ${
          value ? "pr-16" : "pr-4"
        } ${isPending ? "opacity-60" : ""}`}
      />

      {value && (
        <button
          type="button"
          onClick={() => setValue("q", "")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-medium text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
