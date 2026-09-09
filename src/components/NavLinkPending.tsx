"use client";

import { useLinkStatus } from "next/link";

/**
 * A spinner inside a nav link, shown while that link's navigation is in
 * flight — so a tap is acknowledged even before the destination's loading
 * skeleton takes over.
 *
 * Must be rendered inside the <Link> whose status it reports. It is always
 * in the layout and only fades in, rather than appearing and pushing the
 * label sideways; an indicator that shifts what you just clicked is worse
 * than none.
 *
 * Often it never shows: a prefetched route skips the pending phase
 * entirely. That is the good case — the skeleton is already there.
 */
export default function NavLinkPending() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={`ml-1.5 inline-block h-3 w-3 shrink-0 rounded-full border-2 border-current border-r-transparent align-middle transition-opacity ${
        pending ? "animate-spin opacity-70" : "opacity-0"
      }`}
    />
  );
}
