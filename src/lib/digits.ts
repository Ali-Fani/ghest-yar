const FA = "۰۱۲۳۴۵۶۷۸۹";

/** Convert any Latin digits (in a string or number) to Persian digits. */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA[Number(d)]);
}

/** Normalize Persian/Arabic-Indic digits and separators to Latin ones. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",")
    .replace(/،/g, ",");
}

/** Parse an integer from free-form user input (accepts any digit script, ignores separators). */
export function parseIntInput(input: string): number {
  const s = normalizeDigits(input).replace(/[^0-9]/g, "");
  return s ? Number(s) : 0;
}

/** Parse a decimal number from user input. Returns NaN when empty/invalid. */
export function parseDecimalInput(input: string): number {
  const s = normalizeDigits(input).replace(/,/g, "").replace(/[^0-9.]/g, "");
  return s === "" ? NaN : Number(s);
}
