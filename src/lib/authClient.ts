export interface UserTypeClaim {
  _id: string;
  text: string;
}

export interface AuthUser {
  _id: string;
  name: string;
  email: string | null;
  contact: string | null;
  types: UserTypeClaim[];
}

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "authUser";

type Listener = () => void;
let listeners: Listener[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeAuth(callback: Listener) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
  };
}

export function getStoredUserJson(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

export function getServerUserJson(): string | null {
  return null;
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSession(
  user: AuthUser,
  accessToken: string,
  refreshToken: string,
) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  emitChange();
}

export function setAccessToken(accessToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  emitChange();
}

export function updateUserAndAccessToken(user: AuthUser, accessToken: string) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  emitChange();
}

export function clearSession() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  emitChange();
}

/**
 * Exchanges the stored refresh token for a new access token, applying the
 * user record the server returns alongside it — this is where name/types
 * pick up any changes an admin made since the last login or refresh.
 * Clears the session if the refresh token itself is invalid or expired.
 * Returns whether it succeeded.
 */
export async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
      }
      return false;
    }

    const data = await response.json();
    updateUserAndAccessToken(data.user, data.accessToken);
    return true;
  } catch {
    return false;
  }
}
