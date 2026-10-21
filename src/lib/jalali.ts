import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  getDate,
  getDay,
  getDaysInMonth,
  getMonth,
  getYear,
  newDate,
} from "date-fns-jalali";
import { toFaDigits } from "./digits";

export const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
/** Index = JS getDay() (0 = Sunday). */
export const WEEKDAYS_BY_JS_DAY = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه"];
/** Saturday-first week. */
export const WEEK_HEADERS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];
export const WEEK_HEADERS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export interface JDate {
  y: number;
  m: number; // 1..12
  d: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local-time Date -> ISO `YYYY-MM-DD` (Gregorian), no timezone shifting. */
export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ISO `YYYY-MM-DD` -> local midnight Date. */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function toJalali(iso: string): JDate {
  const dt = fromISO(iso);
  return { y: getYear(dt), m: getMonth(dt) + 1, d: getDate(dt) };
}

export function jalaliToISO(y: number, m: number, d: number): string {
  return toISO(newDate(y, m - 1, d));
}

export function jalaliMonthLength(y: number, m: number): number {
  return getDaysInMonth(newDate(y, m - 1, 1));
}

export function isJalaliLeap(y: number): boolean {
  return jalaliMonthLength(y, 12) === 30;
}

export function clampJalali(y: number, m: number, d: number): string {
  return jalaliToISO(y, m, Math.min(d, jalaliMonthLength(y, m)));
}

export function addDaysISO(iso: string, n: number): string {
  return toISO(addDays(fromISO(iso), n));
}

/** Add N Jalali months, always computed from the original date (clamped to month length). */
export function addJalaliMonthsISO(iso: string, n: number): string {
  const start = toJalali(iso);
  const total = start.m - 1 + n;
  const y = start.y + Math.floor(total / 12);
  const m = (((total % 12) + 12) % 12) + 1;
  return clampJalali(y, m, start.d);
}

/** addMonths from date-fns-jalali (clamps natively); exported for cross-checking in tests. */
export function addJalaliMonthsLib(iso: string, n: number): string {
  return toISO(addMonths(fromISO(iso), n));
}

export function diffDays(aISO: string, bISO: string): number {
  return differenceInCalendarDays(fromISO(aISO), fromISO(bISO));
}

/** ۱۴۰۵/۰۸/۰۱ */
export function formatJalaliShort(iso: string): string {
  const { y, m, d } = toJalali(iso);
  return toFaDigits(`${y}/${pad(m)}/${pad(d)}`);
}

/** پنج‌شنبه ۱ آبان ۱۴۰۵ */
export function formatJalaliLong(iso: string): string {
  const { y, m, d } = toJalali(iso);
  const wd = WEEKDAYS_BY_JS_DAY[getDay(fromISO(iso))];
  return `${wd} ${toFaDigits(d)} ${JALALI_MONTHS[m - 1]} ${toFaDigits(y)}`;
}

/** ۱ آبان ۱۴۰۵ */
export function formatJalaliMedium(iso: string): string {
  const { y, m, d } = toJalali(iso);
  return `${toFaDigits(d)} ${JALALI_MONTHS[m - 1]} ${toFaDigits(y)}`;
}

export function formatMonthYear(y: number, m: number): string {
  return `${JALALI_MONTHS[m - 1]} ${toFaDigits(y)}`;
}

/** امروز، فردا، ۳ روز دیگر، ۵ روز گذشته */
export function relativeLabel(iso: string, today: string = todayISO()): string {
  const n = diffDays(iso, today);
  if (n === 0) return "امروز";
  if (n === 1) return "فردا";
  if (n === -1) return "دیروز";
  if (n > 0) return `${toFaDigits(n)} روز دیگر`;
  return `${toFaDigits(-n)} روز گذشته`;
}

/** Index 0..6 where 0 = Saturday. */
export function weekdayIndexSatFirst(iso: string): number {
  return (getDay(fromISO(iso)) + 1) % 7;
}

export interface CalendarCell {
  iso: string;
  jd: JDate;
  inMonth: boolean;
}

/** Month grid Saturday-first, padded with neighbouring month days to full weeks. */
export function monthGrid(y: number, m: number): CalendarCell[] {
  const first = jalaliToISO(y, m, 1);
  const lead = weekdayIndexSatFirst(first);
  const len = jalaliMonthLength(y, m);
  const total = Math.ceil((lead + len) / 7) * 7;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < total; i++) {
    const iso = addDaysISO(first, i - lead);
    const jd = toJalali(iso);
    cells.push({ iso, jd, inMonth: jd.m === m && jd.y === y });
  }
  return cells;
}

export function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const t = y * 12 + (m - 1) + delta;
  return { y: Math.floor(t / 12), m: (((t % 12) + 12) % 12) + 1 };
}

export function currentJalaliYear(): number {
  return toJalali(todayISO()).y;
}

/** Jalali year-month key like "1405-07" */
export function monthKey(iso: string): string {
  const { y, m } = toJalali(iso);
  return `${y}-${pad(m)}`;
}
