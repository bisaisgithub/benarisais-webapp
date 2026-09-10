"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface MultiSelectOption {
  _id: string;
  label: string;
}

interface MultiSelectSearchProps {
  id: string;
  options: MultiSelectOption[];
  /** Selected ids, in the order they were picked. */
  value: string[];
  onChange: (next: string[]) => void;
  isLoading?: boolean;
  loadError?: string | null;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  loadingLabel?: string;
}

/**
 * A searchable multi-select: the chosen values sit in the control as pills
 * that can be removed one by one, and the dropdown filters as you type.
 *
 * A plain multiple <select> is unusable on a phone, and a list of checkboxes
 * stops working once there are more than a handful of options — hence the
 * search. The options are always passed in, never held here, so the caller
 * can re-fetch them each time it opens.
 */
export default function MultiSelectSearch({
  id,
  options,
  value,
  onChange,
  isLoading = false,
  loadError = null,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyLabel = "Nothing to choose from yet.",
  loadingLabel = "Loading…",
}: MultiSelectSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // The dialog around this also closes on Escape; closing the dropdown
        // first is what the key was meant for here.
        event.stopPropagation();
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOpen]);

  const labelById = useMemo(
    () => new Map(options.map((option) => [option._id, option.label])),
    [options],
  );

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(trimmed),
    );
  }, [options, query]);

  function open() {
    setQuery("");
    setIsOpen(true);
    // Focusing the search is the point of opening it.
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function toggle(optionId: string) {
    onChange(
      value.includes(optionId)
        ? value.filter((current) => current !== optionId)
        : [...value, optionId],
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        id={id}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (isOpen) setIsOpen(false);
            else open();
          }
        }}
        className="flex min-h-[42px] w-full cursor-pointer flex-wrap items-center gap-1 rounded-lg border border-foreground/15 px-2 py-1.5 text-sm outline-none focus:border-accent"
      >
        {value.length === 0 ? (
          <span className="px-1 text-foreground/50">
            {isLoading ? loadingLabel : placeholder}
          </span>
        ) : (
          value.map((selectedId) => (
            <span
              key={selectedId}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent/10 py-0.5 pl-2 pr-1 text-xs text-accent"
            >
              <span className="truncate">
                {/* Until the options arrive the id is all there is to show,
                    and dropping the pill would read as data loss. */}
                {labelById.get(selectedId) ??
                  (isLoading ? loadingLabel : "Unknown")}
              </span>
              <button
                type="button"
                aria-label={`Remove ${labelById.get(selectedId) ?? "selection"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(value.filter((current) => current !== selectedId));
                }}
                className="rounded-full px-1 leading-none text-accent/70 transition-colors hover:bg-accent/20 hover:text-accent"
              >
                ×
              </button>
            </span>
          ))
        )}
        <span className="ml-auto shrink-0 pl-1 text-foreground/40">
          {isOpen ? "▴" : "▾"}
        </span>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border border-foreground/15 bg-background shadow-lg">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-t-lg border-b border-foreground/10 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <ul role="listbox" className="max-h-48 overflow-y-auto py-1">
            {isLoading ? (
              <li className="px-3 py-2 text-xs text-foreground/60">
                {loadingLabel}
              </li>
            ) : loadError ? (
              <li className="px-3 py-2 text-xs text-red-500">{loadError}</li>
            ) : options.length === 0 ? (
              <li className="px-3 py-2 text-xs text-foreground/60">
                {emptyLabel}
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-foreground/60">
                No match for “{query.trim()}”.
              </li>
            ) : (
              filtered.map((option) => {
                const isSelected = value.includes(option._id);
                return (
                  <li key={option._id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggle(option._id)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/5 ${
                        isSelected ? "text-accent" : ""
                      }`}
                    >
                      <span className="w-4 shrink-0">
                        {isSelected ? "✓" : ""}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
