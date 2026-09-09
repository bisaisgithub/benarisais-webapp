"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

interface SiteTypeOption {
  _id: string;
  text: string;
}

interface EditSiteModalProps {
  id: string;
  name: string;
  type: string;
  /** The current type's name, shown until the full list arrives. */
  typeText: string;
}

export default function EditSiteModal({
  id,
  name: initialName,
  type: initialType,
  typeText,
}: EditSiteModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [type, setType] = useState(initialType);
  const [availableTypes, setAvailableTypes] = useState<SiteTypeOption[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Read on every open rather than held from the page render: another admin,
   * on another device, may have added a type since this page loaded.
   */
  async function loadTypes() {
    setIsLoadingTypes(true);
    setTypesError(null);
    try {
      const response = await fetch("/api/sites/types");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not load types.");
      }
      setAvailableTypes(Array.isArray(data?.types) ? data.types : []);
    } catch (error) {
      setTypesError(
        error instanceof Error ? error.message : "Could not load types.",
      );
    } finally {
      setIsLoadingTypes(false);
    }
  }

  function openModal() {
    setName(initialName);
    setType(initialType);
    setNameError(null);
    setSubmitError(null);
    setAvailableTypes([]);
    setIsOpen(true);
    loadTypes();
  }

  function closeModal() {
    setIsOpen(false);
  }

  const typeOptions = useMemo(() => {
    if (availableTypes.length > 0) return availableTypes;
    // Until the list arrives the site's own type is all we know, and showing
    // nothing would read as "No type" against a site that has one.
    return initialType ? [{ _id: initialType, text: typeText }] : [];
  }, [availableTypes, initialType, typeText]);

  function validateName(value: string) {
    const error = value.trim().length > 0 ? null : "Site name is required.";
    setNameError(error);
    return error === null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateName(name)) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/sites/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type: type || null }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not update site.");
      }

      closeModal();
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not update site.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label={`Edit ${initialName}`}
        className="rounded-full border border-foreground/15 px-3 py-1 text-xs font-medium transition-colors hover:bg-foreground/10"
      >
        Edit
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
                aria-labelledby="edit-site-modal-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="edit-site-modal-title"
                    className="text-lg font-semibold tracking-tight sm:text-xl"
                  >
                    Edit Site
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

                <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
                  <div>
                    <label
                      htmlFor={`edit-site-name-${id}`}
                      className="block text-sm font-medium"
                    >
                      Name
                    </label>
                    <input
                      id={`edit-site-name-${id}`}
                      type="text"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (nameError) validateName(event.target.value);
                      }}
                      onBlur={(event) => validateName(event.target.value)}
                      autoFocus
                      aria-invalid={nameError ? true : undefined}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    {nameError && (
                      <p className="mt-1 text-xs text-red-500">{nameError}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`edit-site-type-${id}`}
                      className="block text-sm font-medium"
                    >
                      Type
                    </label>
                    <select
                      id={`edit-site-type-${id}`}
                      value={type}
                      onChange={(event) => setType(event.target.value)}
                      disabled={isLoadingTypes}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
                    >
                      <option value="">
                        {isLoadingTypes ? "Loading types…" : "No type"}
                      </option>
                      {typeOptions.map((option) => (
                        <option key={option._id} value={option._id}>
                          {option.text}
                        </option>
                      ))}
                    </select>
                    {typesError && (
                      <p className="mt-1 text-xs text-red-500">{typesError}</p>
                    )}
                  </div>

                  {submitError && (
                    <p className="text-xs text-red-500">{submitError}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-full px-4 py-2 text-sm text-foreground/60 transition-colors hover:bg-foreground/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
