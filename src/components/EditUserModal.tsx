"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import PhoneInput, {
  isValidPhoneNumber,
  type Value as PhoneValue,
} from "react-phone-number-input";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserTypeOption {
  _id: string;
  text: string;
}

interface EditUserModalProps {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
  message: string;
  typeIds: string[];
  availableTypes: UserTypeOption[];
}

export default function EditUserModal({
  id,
  name: initialName,
  email: initialEmail,
  contact: initialContact,
  message: initialMessage,
  typeIds: initialTypeIds,
  availableTypes,
}: EditUserModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [contact, setContact] = useState<PhoneValue | undefined>(
    (initialContact as PhoneValue) || undefined,
  );
  const [message, setMessage] = useState(initialMessage);
  const [selectedTypeIds, setSelectedTypeIds] =
    useState<string[]>(initialTypeIds);

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactMethodError, setContactMethodError] = useState<string | null>(
    null,
  );
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function openModal() {
    setName(initialName);
    setEmail(initialEmail ?? "");
    setContact((initialContact as PhoneValue) || undefined);
    setMessage(initialMessage);
    setSelectedTypeIds(initialTypeIds);
    setNameError(null);
    setEmailError(null);
    setContactError(null);
    setContactMethodError(null);
    setMessageError(null);
    setSubmitError(null);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
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

  function toggleType(typeId: string) {
    setSelectedTypeIds((current) =>
      current.includes(typeId)
        ? current.filter((current_) => current_ !== typeId)
        : [...current, typeId],
    );
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
      const response = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          contact: contact ?? "",
          message: message.trim(),
          types: selectedTypeIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error || "Something went wrong. Please try again.",
        );
      }

      closeModal();
      router.refresh();
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
        onClick={openModal}
        className="rounded-full px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
      >
        Edit
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
                aria-labelledby="edit-user-modal-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="edit-user-modal-title"
                    className="text-lg font-semibold tracking-tight sm:text-xl"
                  >
                    Edit User
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
                      htmlFor={`edit-name-${id}`}
                      className="text-sm font-medium"
                    >
                      Name
                    </label>
                    <input
                      id={`edit-name-${id}`}
                      type="text"
                      required
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (nameError) validateName(event.target.value);
                      }}
                      onBlur={(event) => validateName(event.target.value)}
                      aria-invalid={nameError ? true : undefined}
                      className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent aria-[invalid=true]:border-red-500"
                    />
                    {nameError && (
                      <p className="text-xs text-red-500">{nameError}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`edit-email-${id}`}
                      className="text-sm font-medium"
                    >
                      Email
                    </label>
                    <input
                      id={`edit-email-${id}`}
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
                      className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent aria-[invalid=true]:border-red-500"
                    />
                    {emailError && (
                      <p className="text-xs text-red-500">{emailError}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`edit-contact-${id}`}
                      className="text-sm font-medium"
                    >
                      Contact
                    </label>
                    <PhoneInput
                      id={`edit-contact-${id}`}
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
                      className={`rounded-lg border px-3 py-2 focus-within:border-accent ${
                        contactError ? "border-red-500" : "border-foreground/15"
                      }`}
                    />
                    {contactError && (
                      <p className="text-xs text-red-500">{contactError}</p>
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
                      htmlFor={`edit-message-${id}`}
                      className="text-sm font-medium"
                    >
                      Message
                    </label>
                    <textarea
                      id={`edit-message-${id}`}
                      required
                      rows={4}
                      value={message}
                      onChange={(event) => {
                        setMessage(event.target.value);
                        if (messageError) validateMessage(event.target.value);
                      }}
                      onBlur={(event) => validateMessage(event.target.value)}
                      aria-invalid={messageError ? true : undefined}
                      className="resize-none rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent aria-[invalid=true]:border-red-500"
                    />
                    {messageError && (
                      <p className="text-xs text-red-500">{messageError}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Types</span>
                    {availableTypes.length === 0 ? (
                      <p className="text-xs text-foreground/60">
                        No types yet. Add some from the Types button.
                      </p>
                    ) : (
                      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-foreground/15 p-2">
                        {availableTypes.map((type) => (
                          <label
                            key={type._id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTypeIds.includes(type._id)}
                              onChange={() => toggleType(type._id)}
                              className="h-4 w-4 rounded border-foreground/30 accent-accent"
                            />
                            {type.text}
                          </label>
                        ))}
                      </div>
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
                    {isSubmitting ? "Saving…" : "Save"}
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
