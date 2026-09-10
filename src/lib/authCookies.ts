import type { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "@/lib/jwt";

export const ACCESS_TOKEN_COOKIE = "accessToken";
/**
 * The refresh cookie changed name when it moved to path "/". Keeping the old
 * name would have meant two cookies called the same thing on different paths:
 * NextResponse keys cookies by name alone and would drop one, and a browser
 * holding both sends whichever it likes first. A new name sidesteps both.
 */
export const REFRESH_TOKEN_COOKIE = "refreshSession";

/** The pre-move cookie. Still read, so existing sessions survive the change. */
export const LEGACY_REFRESH_TOKEN_COOKIE = "refreshToken";
/**
 * The refresh token is readable on every request, not just at the refresh
 * endpoint. That is what lets the server tell "signed out" apart from "access
 * token lapsed and can be renewed" while a page renders — see src/proxy.ts.
 * It stays httpOnly and SameSite=Lax, so it is still never readable by script
 * and is not sent on cross-site requests.
 */
const REFRESH_TOKEN_PATH = "/";

/** Where the refresh token used to live. */
const LEGACY_REFRESH_TOKEN_PATH = "/api/auth/refresh";

const isProduction = process.env.NODE_ENV === "production";

export function setAccessTokenCookie(response: NextResponse, token: string) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function setRefreshTokenCookie(response: NextResponse, token: string) {
  response.cookies.set(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: REFRESH_TOKEN_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  expireLegacyRefreshCookie(response);
}

/** Retires the pre-move cookie once a new one has been issued. */
function expireLegacyRefreshCookie(response: NextResponse) {
  response.cookies.set(LEGACY_REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: LEGACY_REFRESH_TOKEN_PATH,
    maxAge: 0,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: REFRESH_TOKEN_PATH,
    maxAge: 0,
  });
  expireLegacyRefreshCookie(response);
}

/** Anything shaped like NextRequest['cookies'] or the store `next/headers` cookies() returns. */
interface CookieStore {
  get(name: string): { value: string } | undefined;
}

export function getAccessTokenFromCookieStore(
  cookieStore: CookieStore,
): string | null {
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export function getAccessTokenFromRequest(request: NextRequest): string | null {
  return getAccessTokenFromCookieStore(request.cookies);
}

export function getRefreshTokenFromRequest(
  request: NextRequest,
): string | null {
  return getRefreshTokenFromCookieStore(request.cookies);
}

export function getRefreshTokenFromCookieStore(
  cookieStore: CookieStore,
): string | null {
  return (
    cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ??
    // A session that predates the move still has only the old cookie, and it
    // reaches the refresh endpoint — which is enough to issue the new one.
    cookieStore.get(LEGACY_REFRESH_TOKEN_COOKIE)?.value ??
    null
  );
}
