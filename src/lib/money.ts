/**
 * Prices are held as whole minor units — cents — never as a decimal. A
 * float cannot represent 0.10 exactly, and money that drifts by a hundredth
 * on every read is worse than money that is slightly awkward to format.
 */
export interface Currency {
  code: string;
  symbol: string;
  label: string;
}

/**
 * Every entry uses two decimal places, which is what the two-field price
 * input assumes. A zero-decimal currency such as JPY would need the form to
 * drop its cents field, so none is offered rather than half-supported.
 */
export const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "MYR", symbol: "RM", label: "Malaysian Ringgit" },
  { code: "NZD", symbol: "NZ$", label: "New Zealand Dollar" },
  { code: "PHP", symbol: "₱", label: "Philippine Peso" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar" },
  { code: "THB", symbol: "฿", label: "Thai Baht" },
];

export const DEFAULT_CURRENCY = "USD";

/** Nine million and change: high enough never to bite, low enough to catch a paste. */
export const MAX_PRICE_WHOLE = 9_999_999;

export function isCurrencyCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    CURRENCIES.some((currency) => currency.code === value)
  );
}

export function currencySymbol(code: string): string {
  return CURRENCIES.find((currency) => currency.code === code)?.symbol ?? code;
}

/** Splits stored cents back into the two fields the form edits. */
export function splitPrice(totalCents: number): {
  whole: number;
  cents: number;
} {
  const safe = Math.max(0, Math.round(totalCents));
  return { whole: Math.floor(safe / 100), cents: safe % 100 };
}

export function joinPrice(whole: number, cents: number): number {
  return whole * 100 + cents;
}

/** "$1,234.50". Grouped, so a mistyped extra zero is visible at a glance. */
export function formatPrice(totalCents: number, code: string): string {
  const { whole, cents } = splitPrice(totalCents);
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currencySymbol(code)}${grouped}.${String(cents).padStart(2, "0")}`;
}

/**
 * Reads the two price fields as they arrive from a request. Both are whole
 * numbers: units of currency, and cents from 0 to 99. Zero is a valid price
 * — a free slot is a real thing to offer.
 */
export function readPrice(
  whole: unknown,
  cents: unknown,
): { error: string } | { priceCents: number } {
  const wholeNumber = typeof whole === "number" ? whole : NaN;
  const centsNumber = typeof cents === "number" ? cents : NaN;

  if (
    !Number.isInteger(wholeNumber) ||
    wholeNumber < 0 ||
    wholeNumber > MAX_PRICE_WHOLE
  ) {
    return {
      error: `Price must be a whole number from 0 to ${MAX_PRICE_WHOLE.toLocaleString("en-US")}.`,
    };
  }

  if (!Number.isInteger(centsNumber) || centsNumber < 0 || centsNumber > 99) {
    return { error: "Cents must be a whole number from 0 to 99." };
  }

  return { priceCents: joinPrice(wholeNumber, centsNumber) };
}
