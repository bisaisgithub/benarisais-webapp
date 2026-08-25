"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

const CONTACT_EMAIL = "benaremail@gmail.com";

export default function RegisterModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");

  function closeModal() {
    setIsOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = `New registration from ${name}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Contact: ${contact}`,
      "",
      message,
    ].join("\n");

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    setName("");
    setEmail("");
    setContact("");
    setMessage("");
    closeModal();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 sm:px-5 sm:text-base"
      >
        Register
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
                aria-labelledby="register-modal-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="register-modal-title"
                    className="text-lg font-semibold tracking-tight sm:text-xl"
                  >
                    Register
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
                  className="mt-4 flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="register-name"
                      className="text-sm font-medium"
                    >
                      Name
                    </label>
                    <input
                      id="register-name"
                      type="text"
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="register-email"
                      className="text-sm font-medium"
                    >
                      Email
                    </label>
                    <input
                      id="register-email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="register-contact"
                      className="text-sm font-medium"
                    >
                      Contact
                    </label>
                    <input
                      id="register-contact"
                      type="text"
                      required
                      value={contact}
                      onChange={(event) => setContact(event.target.value)}
                      className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="register-message"
                      className="text-sm font-medium"
                    >
                      Message
                    </label>
                    <textarea
                      id="register-message"
                      required
                      rows={4}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      className="resize-none rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>

                  <button
                    type="submit"
                    className="mt-2 w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                  >
                    Send to Benar
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
