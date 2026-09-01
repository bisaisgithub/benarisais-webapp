import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const DEBOUNCE_MS = 300;

/**
 * Holds a set of filter inputs and writes them into the URL, which is what
 * the page reads to build its query. Filtering happens in the database, so
 * the row count, the page count and the page itself all come back already
 * filtered — something a client-side filter over one page of rows could not
 * do. Living in the URL also makes a filtered view shareable and lets it
 * survive a refresh.
 *
 * Shared by the column filter row and the search box so the two behave
 * identically and, more importantly, compose: each writes only its own keys
 * and leaves the rest of the query string alone.
 */
export function useUrlFilters<T extends Record<string, string>>(
  basePath: string,
  initialValues: T,
) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<T>(initialValues);

  // Skip the first run: navigating on mount would undo the incoming URL.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Debounced so a typed word is one request, not one per keystroke.
    const timer = setTimeout(() => {
      // Read the live URL rather than a render-time snapshot, so a change
      // made in the other filter component moments ago is not overwritten.
      const params = new URLSearchParams(window.location.search);

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
  }, [values, basePath, router]);

  function setValue(key: keyof T, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function clear() {
    setValues(
      (current) =>
        Object.fromEntries(
          Object.keys(current).map((key) => [key, ""]),
        ) as T,
    );
  }

  const hasValues = Object.values(values).some((value) => value.trim());

  return { values, setValue, clear, hasValues, isPending };
}
