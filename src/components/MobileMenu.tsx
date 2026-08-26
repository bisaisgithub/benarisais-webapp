"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

export default function MobileMenu({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  function handlePanelClick(event: MouseEvent<HTMLDivElement>) {
    // Only close on an actual navigation link (e.g. "Users"). Closing on
    // every click also caught clicks on buttons and the active-type
    // <select>, yanking the panel away before those could register.
    if ((event.target as HTMLElement).closest("a")) {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative sm:contents">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground sm:hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          {isOpen ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      <div
        onClick={handlePanelClick}
        className={`${
          isOpen ? "flex" : "hidden"
        } absolute right-0 top-full z-50 mt-2 w-56 flex-col items-stretch gap-2 rounded-2xl border border-foreground/10 bg-background p-4 shadow-xl sm:static sm:z-auto sm:m-0 sm:flex sm:w-auto sm:flex-row sm:items-center sm:gap-3 sm:border-none sm:bg-transparent sm:p-0 sm:shadow-none`}
      >
        {children}
      </div>
    </div>
  );
}
