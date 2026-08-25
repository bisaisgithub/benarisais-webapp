"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import PhoneInput, {
  isValidPhoneNumber,
  type Value as PhoneValue,
} from "react-phone-number-input";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState<PhoneValue | undefined>();
  const [message, setMessage] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactMethodError, setContactMethodError] = useState<string | null>(
    null,
  );
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function closeModal() {
    setIsOpen(false);
    setSubmitError(null);
  }

  function validateName(value: string) {
    const error = value.trim().length > 0 ? null : "Name is required.";
    setNameError(error);
    return error === null;
  }

  function validateEmail(value: string) {
    const trimmed = value.trim();
    const error =
      trimmed.length === 0 || EMAIL_REGEX.test(trimmed)
        ? null
        : "Enter a valid email address.";
    setEmailError(error);
    return error === null;
  }

  function validateContact(value: PhoneValue | undefined) {
    const error =
      !value || isValidPhoneNumber(value)
        ? null
        : "Enter a valid phone number, including country code.";
    setContactError(error);
    return error === null;
  }

  function validateContactMethod(
    emailValue: string,
    contactValue: PhoneValue | undefined,
  ) {
    const hasEmail = emailValue.trim().length > 0;
    const hasContact = Boolean(contactValue);
    const error =
      hasEmail || hasContact
        ? null
        : "Provide an email address or a contact number.";
    setContactMethodError(error);
    return error === null;
  }

  function validateMessage(value: string) {
    const error = value.trim().length > 0 ? null : "Message is required.";
    setMessageError(error);
    return error === null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const isNameValid = validateName(name);
    const isEmailValid = validateEmail(email);
    const isContactValid = validateContact(contact);
    const hasContactMethod = validateContactMethod(email, contact);
    const isMessageValid = validateMessage(message);

    if (
      !isNameValid ||
      !isEmailValid ||
      !isContactValid ||
      !hasContactMethod ||
      !isMessageValid
    ) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          contact: contact ?? "",
          message: message.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error || "Something went wrong. Please try again.",
        );
      }

      setName("");
      setEmail("");
      setContact(undefined);
      setMessage("");
      setNameError(null);
      setEmailError(null);
      setContactError(null);
      setContactMethodError(null);
      setMessageError(null);
      closeModal();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
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
                      onChange={(event) => {
                        setName(event.target.value);
                        if (nameError) validateName(event.target.value);
                      }}
                      onBlur={(event) => validateName(event.target.value)}
                      aria-invalid={nameError ? true : undefined}
                      aria-describedby={
                        nameError ? "register-name-error" : undefined
                      }
                      className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent aria-[invalid=true]:border-red-500"
                    />
                    {nameError && (
                      <p
                        id="register-name-error"
                        className="text-xs text-red-500"
                      >
                        {nameError}
                      </p>
                    )}
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
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (emailError) validateEmail(event.target.value);
                        if (contactMethodError)
                          validateContactMethod(event.target.value, contact);
                      }}
                      onBlur={(event) => {
                        validateEmail(event.target.value);
                        validateContactMethod(event.target.value, contact);
                      }}
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
                        if (contactMethodError)
                          validateContactMethod(email, value);
                      }}
                      onBlur={() => {
                        validateContact(contact);
                        validateContactMethod(email, contact);
                      }}
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
                    <p
                      className={`text-xs ${
                        contactMethodError
                          ? "text-red-500"
                          : "text-foreground/60"
                      }`}
                    >
                      {contactMethodError ??
                        "Provide at least an email or a phone number."}
                    </p>
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
                      onChange={(event) => {
                        setMessage(event.target.value);
                        if (messageError) validateMessage(event.target.value);
                      }}
                      onBlur={(event) => validateMessage(event.target.value)}
                      aria-invalid={messageError ? true : undefined}
                      aria-describedby={
                        messageError ? "register-message-error" : undefined
                      }
                      className="resize-none rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent aria-[invalid=true]:border-red-500"
                    />
                    {messageError && (
                      <p
                        id="register-message-error"
                        className="text-xs text-red-500"
                      >
                        {messageError}
                      </p>
                    )}
                  </div>

                  {submitError && (
                    <p role="alert" className="text-sm text-red-500">
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-2 w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Submitting…" : "Submit"}
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
