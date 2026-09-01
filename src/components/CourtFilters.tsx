"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const DEBOUNCE_MS = 300;

interface CourtFiltersProps {
  site: string;
  number: string;
}

/**
 * Per-column filters for the courts table. Values live in the URL rather than
 * in component state so the server does the filtering — the row count, the
 * page count and the page itself all come back already filtered, which a
 * client-side filter over one page of rows could not do. Keeping them in the
 * URL also makes a filtered view shareable and survives a refresh.
 */
export default function CourtFilters({
  site: initialSite,
  number: initialNumber,
}: CourtFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [site, setSite] = useState(initialSite);
  const [number, setNumber] = useState(initialNumber);

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

      for (const [key, value] of [
        ["site", site],
        ["number", number],
      ]) {
        if (value.trim()) {
          params.set(key, value.trim());
        } else {
          params.delete(key);
        }
      }

      // A narrower filter can leave the current page past the end.
      params.delete("page");

      startTransition(() => {
        router.push(`/courts?${params.toString()}`, { scroll: false });
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // searchParams is intentionally excluded: it changes as a result of the
    // push below, which would otherwise schedule a second, identical one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, number, router]);

  function clearFilters() {
    setSite("");
    setNumber("");
  }

  const hasFilters = Boolean(site.trim() || number.trim());
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
            onClick={clearFilters}
            className="rounded-full px-2 py-1 text-xs font-medium text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            Clear
          </button>
        )}
      </th>
      <th className="px-4 py-2">
        <label htmlFor="filter-site" className="sr-only">
          Filter by site
        </label>
        <input
          id="filter-site"
          type="search"
          value={site}
          onChange={(event) => setSite(event.target.value)}
          placeholder="Search site…"
          className={inputClass}
        />
      </th>
      <th className="px-4 py-2">
        <label htmlFor="filter-number" className="sr-only">
          Filter by court number
        </label>
        <input
          id="filter-number"
          type="search"
          inputMode="numeric"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          placeholder="Court no…"
          className={inputClass}
        />
      </th>
    </tr>
  );
}
