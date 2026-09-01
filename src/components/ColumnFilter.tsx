"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useListFilters } from "@/components/ListFilters";

export interface FilterField {
  /** URL parameter, and the key the page reads it back under. */
  key: string;
  /** Names the input for screen readers, e.g. "site". */
  label: string;
  placeholder: string;
}

/**
 * A funnel beside a column heading that opens that column's filter input.
 *
 * The panel is portalled and positioned against the viewport because the
 * table sits in an overflow container, which would otherwise clip a panel
 * dropping below the header — and on a short table it would clip most of it.
 * The funnel carries the column's state, since a filter tucked behind an
 * icon is invisible otherwise: an active column reads in the accent colour
 * and the count above the table says how many rows matched.
 */
export default function ColumnFilter({ column }: { column: FilterField }) {
  const { values, setValue } = useListFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const value = values[column.key] ?? "";
  const isActive = Boolean(value.trim());

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 224;
    setPosition({
      top: rect.bottom + 6,
      // Keep the panel on screen when the column sits near the right edge.
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    });
  }, []);

  function open() {
    updatePosition();
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return;

    inputRef.current?.focus();

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    // The panel is positioned against the viewport, so it has to follow its
    // button when anything scrolls. Closing instead was wrong: clicking a
    // funnel in a column that is partly off-screen makes the browser scroll
    // the table to reveal it, and that scroll arrives after the panel opens
    // — so the first tap appeared to do nothing and only the second worked.
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        aria-label={
          isActive
            ? `Filter by ${column.label} (filtering on "${value}")`
            : `Filter by ${column.label}`
        }
        aria-expanded={isOpen}
        title={isActive ? `Filtering: ${value}` : `Filter by ${column.label}`}
        className={`ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${
          isActive
            ? "text-accent"
            : "text-foreground/30 hover:bg-foreground/10 hover:text-foreground"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={isActive ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-3.5 w-3.5"
        >
          <path d="M3 5h18l-7 8v6l-4 2v-8Z" />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: position.top, left: position.left }}
            className="fixed z-[80] w-56 rounded-xl border border-foreground/10 bg-background p-3 shadow-xl"
          >
            <label
              htmlFor={`filter-${column.key}`}
              className="block text-xs font-medium text-foreground/60"
            >
              Filter by {column.label}
            </label>
            <input
              ref={inputRef}
              id={`filter-${column.key}`}
              type="search"
              value={value}
              onChange={(event) => setValue(column.key, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setIsOpen(false);
              }}
              placeholder={column.placeholder}
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-2 py-1 text-sm font-normal outline-none placeholder:text-foreground/40 focus:border-accent"
            />
            {isActive && (
              <button
                type="button"
                onClick={() => {
                  setValue(column.key, "");
                  setIsOpen(false);
                }}
                className="mt-2 w-full rounded-lg px-2 py-1 text-xs font-medium text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                Clear this filter
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
