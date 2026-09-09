"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { refreshSession } from "@/lib/authClient";

/**
 * Between attempts, so a server that keeps rejecting a freshly minted token
 * cannot spin. Long enough to be harmless, short enough that a later
 * navigation still recovers.
 */
const RETRY_COOLDOWN_MS = 15_000;

let lastAttempt = 0;

/**
 * Recovers a page that rendered as signed out because the access token had
 * expired.
 *
 * The access token lives fifteen minutes and the page is server-rendered
 * from it, while the refresh token is scoped to the refresh endpoint's path
 * and so never reaches a page request. When the access token lapses, the
 * server renders "Admin access required" even though the browser can still
 * refresh — which is why the page looked signed out while the navbar looked
 * signed in, and why reloading fixed it.
 *
 * Rendered only where the token itself failed, never where a valid token
 * simply is not an admin's: refreshing would succeed there, re-render, fail
 * the admin check again, and loop.
 */
export default function SessionRecovery() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (Date.now() - lastAttempt < RETRY_COOLDOWN_MS) return;
    lastAttempt = Date.now();

    refreshSession().then((renewed) => {
      // Only on success: a failed refresh means the session really is over,
      // and re-rendering would just show the same message again.
      if (renewed) {
        router.refresh();
      }
    });
  }, [router]);

  return null;
}
