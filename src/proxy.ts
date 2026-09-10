import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  setAccessTokenCookie,
} from "@/lib/authCookies";
import { signAccessToken, verifyAccessToken, verifyRefreshToken } from "@/lib/jwt";

/**
 * Renews a lapsed access token before anything else sees the request.
 *
 * The access token lives fifteen minutes; pages are server-rendered from it.
 * Without this, a token that lapsed while the tab sat idle made the very next
 * page render as signed out — the page said "Admin access required" to
 * someone who was still signed in, and only a reload fixed it. Recovering
 * from that in the browser was always a step behind: the wrong page had
 * already been rendered and shown.
 *
 * Here the renewal happens first, on the server, for the request that needs
 * it. The refreshed token is written back to the browser *and* onto this
 * request, so the page it is about to render already sees a signed-in user.
 *
 * Only the token is renewed. Whether that user is an admin is still decided
 * by the page and the API routes, against the database, on every request.
 */
export async function proxy(request: NextRequest) {
  if (isTokenValid(getAccessTokenFromRequest(request))) {
    return NextResponse.next();
  }

  const refreshToken = getRefreshTokenFromRequest(request);
  if (!refreshToken) {
    return NextResponse.next();
  }

  let userId: string;
  try {
    userId = verifyRefreshToken(refreshToken).sub;
  } catch {
    // A refresh token that is itself expired or forged means the session is
    // genuinely over. Leave it to the page to say so.
    return NextResponse.next();
  }

  const accessToken = signAccessToken(userId);

  // Both halves matter: the request carries the new token into this render,
  // the response carries it back to the browser for the next one.
  request.cookies.set(ACCESS_TOKEN_COOKIE, accessToken);
  const response = NextResponse.next({
    request: { headers: request.headers },
  });
  setAccessTokenCookie(response, accessToken);
  return response;
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    verifyAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  /**
   * Everything except Next's own assets and /api/auth/*.
   *
   * The auth routes issue and clear these cookies themselves. If the proxy
   * also set one on their responses, two Set-Cookie headers for the same name
   * would race — signing out could leave a freshly minted access token behind,
   * and signing in as someone else could carry the previous session's token
   * into the new one. Those routes see the request exactly as the browser sent
   * it; the client wrapper in src/lib/apiFetch.ts covers the authenticated one
   * among them.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
