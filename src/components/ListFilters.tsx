"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useUrlFilters } from "@/lib/useUrlFilters";

interface ListFiltersContextValue {
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  clear: () => void;
  hasValues: boolean;
  isPending: boolean;
}

const ListFiltersContext = createContext<ListFiltersContextValue | null>(null);

export function useListFilters(): ListFiltersContextValue {
  const context = useContext(ListFiltersContext);
  if (!context) {
    throw new Error("Filter components must be rendered inside <ListFilters>.");
  }
  return context;
}

/**
 * Owns every filter value on a list page — the search box and each column
 * filter — and writes them into the URL as one query.
 *
 * A single owner is the point. When each input pushed its own copy of the
 * query string, two changes inside one debounce window raced: router.push is
 * async, so the second push read a URL the first had not yet updated and
 * silently reverted it, leaving an input showing one value and the table
 * showing another. One owner means one push, and no value can be lost.
 */
export default function ListFilters({
  basePath,
  initial,
  children,
}: {
  basePath: string;
  initial: Record<string, string>;
  children: ReactNode;
}) {
  const filters = useUrlFilters(basePath, initial);

  return (
    <ListFiltersContext.Provider value={filters}>
      {children}
    </ListFiltersContext.Provider>
  );
}
