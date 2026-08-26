"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  clearSession,
  getAccessToken,
  getServerUserJson,
  getStoredUserJson,
  refreshSession,
  setSession,
  subscribeAuth,
  updateUserAndAccessToken,
  type AuthUser,
} from "@/lib/authClient";

export default function LoginModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSwitchingType, setIsSwitchingType] = useState(false);
  const [switchTypeError, setSwitchTypeError] = useState<string | null>(null);

  const storedUserJson = useSyncExternalStore(
    subscribeAuth,
    getStoredUserJson,
    getServerUserJson,
  );
  const user = useMemo<AuthUser | null>(() => {
    if (!storedUserJson) return null;
    try {
      return JSON.parse(storedUserJson) as AuthUser;
    } catch {
      return null;
    }
  }, [storedUserJson]);

  useEffect(() => {
    refreshSession();
  }, []);

  function openModal() {
    setIdentifier("");
    setPassword("");
    setError(null);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
  }

  function handleLogout() {
    clearSession();
  }

  async function handleActiveTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const typeId = event.target.value;
    if (!typeId) return;

    setIsSwitchingType(true);
    setSwitchTypeError(null);

    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error("You're not signed in.");
      }

      const response = await fetch("/api/auth/active-type", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ typeId }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not switch type.");
      }

      updateUserAndAccessToken(data.user, data.accessToken);
    } catch (switchError) {
      setSwitchTypeError(
        switchError instanceof Error
          ? switchError.message
          : "Could not switch type.",
      );
    } finally {
      setIsSwitchingType(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!identifier.trim() || !password) {
      setError("Enter your email or contact number, and your password.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not log in. Please try again.");
      }

      setSession(data.user, data.accessToken, data.refreshToken);
      closeModal();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not log in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (user) {
    return (
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground/70">Hi, {user.name}</span>
          {user.types.length > 0 && (
            <select
              value={user.types[0]._id}
              onChange={handleActiveTypeChange}
              disabled={isSwitchingType}
              aria-label="Active type"
              className="rounded-lg border border-foreground/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {user.types.map((type) => (
                <option key={type._id} value={type._id}>
                  {type.text}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:px-5 sm:text-base"
          >
            Log Out
          </button>
        </div>
        {switchTypeError && (
          <p className="text-xs text-red-500">{switchTypeError}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:px-5 sm:text-base"
      >
        Sign In
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] overflow-y-auto bg-black/50"
            role="presentation"
            onClick={closeModal}
          >
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="login-modal-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="login-modal-title"
                    className="text-lg font-semibold tracking-tight sm:text-xl"
                  >
                    Sign In
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Close"
                    className="rounded-full p-1 text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={handleSubmit}
                  noValidate
                  className="mt-4 flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="login-identifier"
                      className="text-sm font-medium"
                    >
                      Email or Contact
                    </label>
                    <input
                      id="login-identifier"
                      type="text"
                      required
                      autoComplete="username"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="login-password"
                      className="text-sm font-medium"
                    >
                      Password
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>

                  {error && (
                    <p role="alert" className="text-sm text-red-500">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-2 w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Signing in…" : "Sign In"}
                  </button>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
