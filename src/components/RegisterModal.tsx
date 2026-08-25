"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import PhoneInput, {
  isValidPhoneNumber,
  type Value as PhoneValue,
} from "react-phone-number-input";

const CONTACT_EMAIL = "benaremail@gmail.com";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState<PhoneValue | undefined>();
  const [message, setMessage] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  function closeModal() {
    setIsOpen(false);
  }

  function validateEmail(value: string) {
    const error = EMAIL_REGEX.test(value)
      ? null
      : "Enter a valid email address.";
    setEmailError(error);
    return error === null;
  }

  function validateContact(value: PhoneValue | undefined) {
    const error =
      value && isValidPhoneNumber(value)
        ? null
        : "Enter a valid phone number, including country code.";
    setContactError(error);
    return error === null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const isEmailValid = validateEmail(email);
    const isContactValid = validateContact(contact);
    if (!isEmailValid || !isContactValid) {
      return;
    }

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
    setContact(undefined);
    setMessage("");
    setEmailError(null);
    setContactError(null);
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
                  noValidate
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
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (emailError) validateEmail(event.target.value);
                      }}
                      onBlur={(event) => validateEmail(event.target.value)}
                      aria-invalid={emailError ? true : undefined}
                      aria-describedby={
                        emailError ? "register-email-error" : undefined
                      }
                      className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent aria-[invalid=true]:border-red-500"
                    />
                    {emailError && (
                      <p
                        id="register-email-error"
                        className="text-xs text-red-500"
                      >
                        {emailError}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="register-contact"
                      className="text-sm font-medium"
                    >
                      Contact
                    </label>
                    <PhoneInput
                      id="register-contact"
                      defaultCountry="US"
                      international
                      value={contact}
                      onChange={(value) => {
                        setContact(value);
                        if (contactError) validateContact(value);
                      }}
                      onBlur={() => validateContact(contact)}
                      numberInputProps={{
                        className:
                          "min-w-0 flex-1 bg-transparent text-sm outline-none",
                      }}
                      aria-invalid={contactError ? true : undefined}
                      aria-describedby={
                        contactError ? "register-contact-error" : undefined
                      }
                      className={`rounded-lg border px-3 py-2 focus-within:border-accent ${
                        contactError ? "border-red-500" : "border-foreground/15"
                      }`}
                    />
                    {contactError && (
                      <p
                        id="register-contact-error"
                        className="text-xs text-red-500"
                      >
                        {contactError}
                      </p>
                    )}
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
