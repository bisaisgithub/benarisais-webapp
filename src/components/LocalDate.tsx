"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function formatUtc(value: string) {
  return (
    new Date(value).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC"
  );
}

function formatLocal(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function LocalDate({ value }: { value: string }) {
  const formatted = useSyncExternalStore(
    subscribe,
    () => formatLocal(value),
    () => formatUtc(value),
  );

  return <span suppressHydrationWarning>{formatted}</span>;
}
