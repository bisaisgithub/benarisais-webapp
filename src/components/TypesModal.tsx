"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getAccessToken } from "@/lib/authClient";

interface UserType {
  _id: string;
  text: string;
}

export default function TypesModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [types, setTypes] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function resetState() {
    setQuery("");
    setAddError(null);
    setEditingId(null);
    setEditingText("");
    setEditError(null);
  }

  async function loadTypes() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/users/types");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not load types.");
      }
      setTypes(Array.isArray(data?.types) ? data.types : []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load types.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openModal() {
    setIsOpen(true);
    resetState();
    loadTypes();
  }

  function closeModal() {
    setIsOpen(false);
  }

  const trimmedQuery = query.trim();
  const filteredTypes = useMemo(() => {
    if (!trimmedQuery) return types;
    const lower = trimmedQuery.toLowerCase();
    return types.filter((type) => type.text.toLowerCase().includes(lower));
  }, [types, trimmedQuery]);

  const hasExactMatch = types.some(
    (type) => type.text.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showAddOption = trimmedQuery.length > 0 && !hasExactMatch;

  async function handleAdd() {
    if (!trimmedQuery || isAdding) return;

    setIsAdding(true);
    setAddError(null);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error("You must be signed in as an admin to add a type.");
      }

      const response = await fetch("/api/users/types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text: trimmedQuery }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not add type.");
      }
      setTypes((current) =>
        [...current, data as UserType].sort((a, b) =>
          a.text.localeCompare(b.text),
        ),
      );
      setQuery("");
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : "Could not add type.",
      );
    } finally {
      setIsAdding(false);
    }
  }

  function startEdit(type: UserType) {
    setEditingId(type._id);
    setEditingText(type.text);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
    setEditError(null);
  }

  async function handleSaveEdit() {
    const trimmedEditingText = editingText.trim();
    if (!editingId || !trimmedEditingText || isSavingEdit) return;

    setIsSavingEdit(true);
    setEditError(null);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error("You must be signed in as an admin to rename a type.");
      }

      const response = await fetch("/api/users/types", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: editingId, text: trimmedEditingText }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not update type.");
      }
      setTypes((current) =>
        current
          .map((type) => (type._id === editingId ? (data as UserType) : type))
          .sort((a, b) => a.text.localeCompare(b.text)),
      );
      cancelEdit();
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Could not update type.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 sm:px-5 sm:text-base"
      >
        Types
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] overflow-y-auto bg-black/50"
            role="presentation"
            onClick={closeModal}
          >
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="types-modal-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="types-modal-title"
                    className="text-lg font-semibold tracking-tight sm:text-xl"
                  >
                    User Types
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Close"
                    className="rounded-full p-1 text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && showAddOption) {
                      event.preventDefault();
                      handleAdd();
                    }
                  }}
                  placeholder="Search types…"
                  autoFocus
                  className="mt-4 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                />

                {addError && (
                  <p className="mt-2 text-xs text-red-500">{addError}</p>
                )}

                {showAddOption && (
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isAdding}
                    className="mt-2 w-full rounded-lg border border-dashed border-accent px-3 py-2 text-left text-sm text-accent transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAdding ? "Adding…" : `+ Add "${trimmedQuery}"`}
                  </button>
                )}

                <div className="mt-3 max-h-72 overflow-y-auto">
                  {isLoading ? (
                    <p className="py-4 text-center text-sm text-foreground/60">
                      Loading…
                    </p>
                  ) : loadError ? (
                    <p className="py-4 text-center text-sm text-red-500">
                      {loadError}
                    </p>
                  ) : filteredTypes.length === 0 ? (
                    <p className="py-4 text-center text-sm text-foreground/60">
                      No types found.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {filteredTypes.map((type) => (
                        <li
                          key={type._id}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-foreground/5"
                        >
                          {editingId === type._id ? (
                            <>
                              <input
                                type="text"
                                value={editingText}
                                onChange={(event) =>
                                  setEditingText(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleSaveEdit();
                                  } else if (event.key === "Escape") {
                                    cancelEdit();
                                  }
                                }}
                                autoFocus
                                className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
                              />
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={isSavingEdit}
                                className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSavingEdit ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="shrink-0 rounded-full px-3 py-1 text-xs text-foreground/60 transition-colors hover:bg-foreground/10"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {type.text}
                              </span>
                              <button
                                type="button"
                                onClick={() => startEdit(type)}
                                aria-label={`Rename ${type.text}`}
                                className="shrink-0 rounded-full px-3 py-1 text-xs text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                              >
                                Rename
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {editError && (
                  <p className="mt-2 text-xs text-red-500">{editError}</p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
