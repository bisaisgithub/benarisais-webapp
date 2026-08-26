import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

export interface AccessTokenPayload {
  sub: string;
}

export interface RefreshTokenPayload {
  sub: string;
}

function getAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_ACCESS_SECRET environment variable");
  }
  return secret;
}

function getRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_REFRESH_SECRET environment variable");
  }
  return secret;
}

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId }, getAccessSecret(), {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId }, getRefreshSecret(), {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getAccessSecret()) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getRefreshSecret()) as RefreshTokenPayload;
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}
