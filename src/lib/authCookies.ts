import type { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "@/lib/jwt";

export const ACCESS_TOKEN_COOKIE = "accessToken";
export const REFRESH_TOKEN_COOKIE = "refreshToken";
const REFRESH_TOKEN_PATH = "/api/auth/refresh";

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
  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}
