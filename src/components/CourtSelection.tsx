"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface CourtSelectionContextValue {
  selected: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
  allSelected: boolean;
  someSelected: boolean;
}

const CourtSelectionContext =
  createContext<CourtSelectionContextValue | null>(null);

export function useCourtSelection(): CourtSelectionContextValue {
  const context = useContext(CourtSelectionContext);
  if (!context) {
    throw new Error("Selection components need <CourtSelection> above them.");
  }
  return context;
}

/**
 * Holds which rows on the current page are ticked.
 *
 * The selection is deliberately per page: selecting rows, paging away and
 * acting on rows no longer on screen is how bulk edits go wrong, so a change
 * of page or filter starts the selection over.
 */
export default function CourtSelection({
  ids,
  children,
}: {
  ids: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  // Adjusting during render rather than in an effect, which is React's
  // pattern for resetting state when a prop changes: a new page or filter
  // brings different rows, and the old ticks no longer refer to anything on
  // screen.
  const key = ids.join(",");
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setSelected([]);
  }

  const visible = selected.filter((id) => ids.includes(id));

  const value: CourtSelectionContextValue = {
    selected: visible,
    isSelected: (id) => visible.includes(id),
    toggle: (id) =>
      setSelected((current) =>
        current.includes(id)
          ? current.filter((other) => other !== id)
          : [...current, id],
      ),
    toggleAll: () =>
      setSelected((current) => (current.length === ids.length ? [] : ids)),
    clear: () => setSelected([]),
    allSelected: ids.length > 0 && visible.length === ids.length,
    someSelected: visible.length > 0,
  };

  return (
    <CourtSelectionContext.Provider value={value}>
      {children}
    </CourtSelectionContext.Provider>
  );
}

const CHECKBOX_CLASS =
  "h-4 w-4 cursor-pointer accent-accent align-middle";

/** Header checkbox: ticks or clears every row on this page. */
export function SelectAllCheckbox() {
  const { allSelected, someSelected, toggleAll } = useCourtSelection();

  return (
    <input
      type="checkbox"
      checked={allSelected}
      // Some-but-not-all reads as indeterminate rather than unticked, so the
      // header never implies the page is empty of selections.
      ref={(node) => {
        if (node) node.indeterminate = someSelected && !allSelected;
      }}
      onChange={toggleAll}
      aria-label="Select all courts on this page"
      className={CHECKBOX_CLASS}
    />
  );
}

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { isSelected, toggle } = useCourtSelection();

  return (
    <input
      type="checkbox"
      checked={isSelected(id)}
      onChange={() => toggle(id)}
      aria-label={`Select ${label}`}
      className={CHECKBOX_CLASS}
    />
  );
}
