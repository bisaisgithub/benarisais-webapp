"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import LocalDate from "@/components/LocalDate";
import type { UpdateHistoryView } from "@/lib/updateHistory";

interface HistoryModalProps {
  title: string;
  createdByName: string;
  createdAt: string | null;
  history: UpdateHistoryView[];
}

export default function HistoryModal({
  title,
  createdByName,
  createdAt,
  history,
}: HistoryModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`History for ${title}`}
        title="History"
        className="rounded-full border border-foreground/15 p-1.5 text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M3 3v5h5" />
          <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          // z-[70] so this sits above the z-[60] modals it can be opened from.
          <div
            className="fixed inset-0 z-[70] overflow-y-auto bg-black/50"
            role="presentation"
            onClick={() => setIsOpen(false)}
          >
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="history-modal-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-lg rounded-2xl border border-foreground/10 bg-background p-6 shadow-xl"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2
                    id="history-modal-title"
                    className="min-w-0 truncate text-lg font-semibold tracking-tight sm:text-xl"
                  >
                    History — {title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close"
                    className="shrink-0 rounded-full p-1 text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <p className="mt-3 text-sm text-foreground/60">
                  Created by{" "}
                  <span className="text-foreground">{createdByName}</span>
                  {createdAt ? (
                    <>
                      {" "}
                      on <LocalDate value={createdAt} />
                    </>
                  ) : null}
                </p>

                <div className="mt-4 max-h-80 overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="py-4 text-center text-sm text-foreground/60">
                      No edits recorded yet.
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-3">
                      {history.map((entry, index) => (
                        <li
                          key={`${entry.updatedAt}-${index}`}
                          className="rounded-xl border border-foreground/10 p-3"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="text-sm font-medium">
                              {entry.updatedByName}
                            </span>
                            <span className="text-xs text-foreground/60">
                              <LocalDate value={entry.updatedAt} />
                            </span>
                          </div>

                          {entry.changes.length === 0 ? (
                            <p className="mt-2 text-xs text-foreground/60">
                              No field changes recorded.
                            </p>
                          ) : (
                            <dl className="mt-2 flex flex-col gap-1">
                              {entry.changes.map((change) => (
                                <div
                                  key={change.field}
                                  className="flex gap-2 text-xs"
                                >
                                  <dt className="shrink-0 text-foreground/60">
                                    {change.field}
                                  </dt>
                                  <dd className="min-w-0 break-words">
                                    {change.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <p className="mt-4 text-xs text-foreground/50">
                  Only the 10 most recent edits are kept.
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
