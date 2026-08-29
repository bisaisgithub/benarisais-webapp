"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function AddSiteForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubmitError("Site name is required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not add site.");
      }

      setName("");
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not add site.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="new-site-name" className="sr-only">
            Site name
          </label>
          <input
            id="new-site-name"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSubmitError(null);
            }}
            placeholder="Site name"
            aria-describedby={submitError ? "new-site-error" : undefined}
            className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Adding…" : "Add site"}
        </button>
      </div>

      {submitError && (
        <p id="new-site-error" className="mt-2 text-xs text-red-500">
          {submitError}
        </p>
      )}
    </form>
  );
}
