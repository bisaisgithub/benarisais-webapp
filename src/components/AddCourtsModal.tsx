"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

const MAX_COURTS_PER_ADD = 100;
const PREVIEW_LIMIT = 20;

interface SiteOption {
  _id: string;
  name: string;
  lastNumber: number;
}

export default function AddCourtsModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const [sites, setSites] = useState<SiteOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [siteId, setSiteId] = useState("");
  const [count, setCount] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function loadSites() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/courts/summary");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not load sites.");
      }
      setSites(Array.isArray(data?.sites) ? data.sites : []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load sites.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openModal() {
    setSiteId("");
    setCount("1");
    setSubmitError(null);
    setIsOpen(true);
    loadSites();
  }

  function closeModal() {
    setIsOpen(false);
  }

  const selectedSite = sites.find((site) => site._id === siteId) ?? null;
  const parsedCount = Number(count);
  const isCountValid =
    Number.isInteger(parsedCount) &&
    parsedCount >= 1 &&
    parsedCount <= MAX_COURTS_PER_ADD;

  // What the admin is about to create, spelled out before they commit.
  const previewNumbers =
    selectedSite && isCountValid
      ? Array.from(
          { length: parsedCount },
          (_, index) => selectedSite.lastNumber + index + 1,
        )
      : [];
  const previewText =
    previewNumbers.length > PREVIEW_LIMIT
      ? `${previewNumbers.slice(0, PREVIEW_LIMIT).join(", ")}, … (${previewNumbers.length} courts)`
      : previewNumbers.join(", ");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!siteId) {
      setSubmitError("Select a site.");
      return;
    }
    if (!isCountValid) {
      setSubmitError(
        `Enter a whole number of courts between 1 and ${MAX_COURTS_PER_ADD}.`,
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/courts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, count: parsedCount }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not add courts.");
      }

      closeModal();
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not add courts.",
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
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Add
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
                aria-labelledby="add-courts-modal-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="add-courts-modal-title"
                    className="text-lg font-semibold tracking-tight sm:text-xl"
                  >
                    Add Courts
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

                <form
                  onSubmit={handleSubmit}
                  className="mt-4 flex flex-col gap-4"
                >
                  <div>
                    <label
                      htmlFor="add-courts-site"
                      className="block text-sm font-medium"
                    >
                      Site
                    </label>
                    <select
                      id="add-courts-site"
                      value={siteId}
                      onChange={(event) => {
                        setSiteId(event.target.value);
                        setSubmitError(null);
                      }}
                      disabled={isLoading || sites.length === 0}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
                    >
                      <option value="">
                        {isLoading ? "Loading…" : "Select a site"}
                      </option>
                      {sites.map((site) => (
                        <option key={site._id} value={site._id}>
                          {site.name}
                        </option>
                      ))}
                    </select>
                    {loadError && (
                      <p className="mt-1 text-xs text-red-500">{loadError}</p>
                    )}
                    {!isLoading && !loadError && sites.length === 0 && (
                      <p className="mt-1 text-xs text-foreground/60">
                        No sites yet. Add a site first.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="add-courts-count"
                      className="block text-sm font-medium"
                    >
                      Number of courts
                    </label>
                    <input
                      id="add-courts-count"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_COURTS_PER_ADD}
                      step={1}
                      value={count}
                      onChange={(event) => {
                        setCount(event.target.value);
                        setSubmitError(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>

                  <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-3 text-sm">
                    {selectedSite ? (
                      <>
                        <p className="text-foreground/70">
                          Last court number:{" "}
                          <span className="font-medium text-foreground">
                            {selectedSite.lastNumber === 0
                              ? "none yet"
                              : selectedSite.lastNumber}
                          </span>
                        </p>
                        <p className="mt-1 text-foreground/70">
                          Will create:{" "}
                          <span className="font-medium text-foreground">
                            {previewNumbers.length > 0 ? previewText : "—"}
                          </span>
                        </p>
                      </>
                    ) : (
                      <p className="text-foreground/60">
                        Select a site to see its last court number and what
                        will be created.
                      </p>
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
