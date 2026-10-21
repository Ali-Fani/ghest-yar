import { toFaDigits } from "./digits";

/** Group an integer with the Persian thousands separator. */
export function groupDigits(n: number): string {
  const neg = n < 0;
  const s = String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  return (neg ? "-" : "") + toFaDigits(s);
}

/** ۱۲٬۵۰۰٬۰۰۰ تومان */
export function formatToman(n: number): string {
  return `${groupDigits(n)} تومان`;
}

/** Number only, grouped, Persian digits. */
export function formatNumber(n: number): string {
  return groupDigits(n);
}

function trimDecimal(x: number): string {
  const r = Math.round(x * 10) / 10;
  return toFaDigits(Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", "٫"));
}

/** ۱۲٫۵ میلیون, ۳ میلیارد, ... (no currency suffix) */
export function formatTomanCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return sign + trimDecimal(abs / 1e12) + " تریلیون";
  if (abs >= 1e9) return sign + trimDecimal(abs / 1e9) + " میلیارد";
  if (abs >= 1e6) return sign + trimDecimal(abs / 1e6) + " میلیون";
  if (abs >= 1e3) return sign + trimDecimal(abs / 1e3) + " هزار";
  return sign + toFaDigits(abs);
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}
