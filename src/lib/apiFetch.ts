import { refreshSession } from "@/lib/authClient";

/**
 * fetch for this app's own API, with one retry after renewing the session.
 *
 * src/proxy.ts renews a lapsed access token before a request reaches a route,
 * so most of the time this changes nothing. It covers what the proxy cannot:
 * a browser still holding a refresh cookie from before the proxy existed,
 * whose cookie the proxy never sees, and a token that lapses in the moment
 * between the proxy checking it and the route reading it.
 *
 * Only a 401 is retried. A 403 means the session is fine and the account
 * simply is not allowed to do this, and renewing would not change that.
 */
export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) {
    return response;
  }

  const renewed = await refreshSession();
  if (!renewed) {
    // The session really is over. Hand back the original 401 so the caller
    // shows the server's own message rather than a second, vaguer one.
    return response;
  }

  return fetch(input, init);
}
