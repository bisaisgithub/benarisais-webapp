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

export function setUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  emitChange();
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
  emitChange();
}

/** Clears the session cookies server-side, then clears the cached profile. */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Best-effort — clear the local profile regardless.
  }
  clearUser();
}

/**
 * Exchanges the refresh token cookie for a new access token cookie, applying
 * the user record the server returns alongside it — this is where
 * name/types pick up any changes an admin made since the last login or
 * refresh. Clears the cached profile if the refresh token itself is invalid
 * or expired. Returns whether it succeeded.
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", { method: "POST" });

    if (!response.ok) {
      if (response.status === 401 || response.status === 400) {
        clearUser();
      }
      return false;
    }

    const data = await response.json();
    setUser(data.user);
    return true;
  } catch {
    return false;
  }
}
