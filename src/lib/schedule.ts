import { addDaysISO, addJalaliMonthsISO } from "./jalali";
import { roundTo } from "./money";
import type { FeeType } from "./types";

export type IntervalType = "monthly" | "weekly" | "days";

export interface ScheduleParams {
  totalAmount: number;
  downPayment: number;
  /** Annual profit percent. */
  profitRate: number;
  count: number;
  intervalType: IntervalType;
  intervalValue: number;
  startDate: string; // ISO
  /** User override of the per-installment amount (applied to every installment). */
  overrideAmount?: number | null;
  /** Optional fee (کارمزد): fixed Toman, or % of the financed amount. Spread equally over the installments. */
  feeType?: FeeType;
  feeValue?: number;
}

export interface ScheduleItem {
  seq: number;
  due_date: string;
  amount: number;
}

export interface ScheduleResult {
  items: ScheduleItem[];
  financed: number;
  /** Fee included in the installments (0 when none). */
  fee: number;
  /** Regular (non-last) installment amount. */
  installmentAmount: number;
  /** Sum of all installments. */
  installmentsTotal: number;
  /** installmentsTotal + downPayment */
  totalPayable: number;
  /** totalPayable - totalAmount (never negative) */
  totalProfit: number;
}

export function dueDates(startDate: string, count: number, type: IntervalType, value: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < count; k++) {
    if (type === "monthly") out.push(addJalaliMonthsISO(startDate, k * value));
    else if (type === "weekly") out.push(addDaysISO(startDate, k * value * 7));
    else out.push(addDaysISO(startDate, k * value));
  }
  return out;
}

/** Rate per period as a fraction. Monthly: r/1200 per month. Weekly/days: r/100 * days/365. */
export function periodRate(profitRate: number, type: IntervalType, value: number): number {
  if (type === "monthly") return (profitRate / 1200) * value;
  const days = type === "weekly" ? 7 * value : value;
  return ((profitRate / 100) * days) / 365;
}

/** Exact (unrounded) installment: A = P*i*(1+i)^n / ((1+i)^n - 1); P/n when i = 0. */
export function exactInstallment(financed: number, i: number, n: number): number {
  if (n <= 0) return 0;
  if (i <= 0) return financed / n;
  const f = Math.pow(1 + i, n);
  return (financed * i * f) / (f - 1);
}

/** Fee in Toman for a base amount. Percent fees are of `base`. */
export function feeAmount(base: number, type: FeeType | undefined, value: number | undefined): number {
  const v = value ?? 0;
  if (!type || type === "none" || !(v > 0)) return 0;
  return type === "fixed" ? Math.round(v) : Math.round((Math.max(0, base) * v) / 100);
}

export function generateSchedule(p: ScheduleParams): ScheduleResult {
  const n = Math.max(1, Math.floor(p.count));
  const financed = Math.max(0, p.totalAmount - p.downPayment);
  const i = periodRate(p.profitRate, p.intervalType, p.intervalValue);
  const exact = exactInstallment(financed, i, n);
  const fee = feeAmount(financed, p.feeType, p.feeValue);
  const dates = dueDates(p.startDate, n, p.intervalType, p.intervalValue);

  let regular: number;
  let last: number;
  if (p.overrideAmount != null && p.overrideAmount > 0) {
    regular = Math.round(p.overrideAmount);
    last = regular;
  } else {
    regular = roundTo(exact + fee / n, 1000);
    const target = (i > 0 ? Math.round(exact * n) : financed) + fee;
    last = target - regular * (n - 1);
    if (last <= 0 && n > 1) {
      // Degenerate (tiny amounts): fall back to an exact integer split.
      regular = Math.floor(target / n);
      last = target - regular * (n - 1);
    }
  }

  const items: ScheduleItem[] = dates.map((d, idx) => ({
    seq: idx + 1,
    due_date: d,
    amount: idx === n - 1 ? last : regular,
  }));
  const installmentsTotal = items.reduce((s, x) => s + x.amount, 0);
  const totalPayable = installmentsTotal + p.downPayment;
  return {
    items,
    fee,
    financed,
    installmentAmount: regular,
    installmentsTotal,
    totalPayable,
    totalProfit: Math.max(0, totalPayable - p.totalAmount),
  };
}

export interface SplitParams {
  amount: number;
  parts: number;
  intervalType: IntervalType;
  intervalValue: number;
  /** Part 1 is due (and already paid) on the purchase date. */
  firstAtPurchase: boolean;
  purchaseDate: string; // ISO
  feeType?: FeeType;
  feeValue?: number;
}

export interface SplitItem extends ScheduleItem {
  paid_amount?: number;
  paid_date?: string | null;
}

export interface SplitResult extends Omit<ScheduleResult, "items"> {
  items: SplitItem[];
  /** Purchase + fee. */
  total: number;
  firstDue: string;
}

/**
 * Pay-in-4 / BNPL schedule for one purchase. Fee is spread equally over the parts with the
 * usual rule (round to 1,000, remainder on the last part), so parts always sum to amount + fee.
 */
export function generateSplit(p: SplitParams): SplitResult {
  const parts = Math.max(1, Math.floor(p.parts));
  const base = generateSchedule({
    totalAmount: p.amount, downPayment: 0, profitRate: 0, count: parts, intervalType: p.intervalType,
    intervalValue: p.intervalValue, startDate: p.purchaseDate, feeType: p.feeType, feeValue: p.feeValue,
  });
  // Dates run from the purchase date (always computed from it, so month-end clamping stays stable).
  const all = dueDates(p.purchaseDate, parts + 1, p.intervalType, p.intervalValue);
  const dates = p.firstAtPurchase ? all.slice(0, parts) : all.slice(1);
  const items: SplitItem[] = base.items.map((it, idx) => {
    const item: SplitItem = { seq: it.seq, due_date: dates[idx], amount: it.amount };
    if (p.firstAtPurchase && idx === 0) {
      item.paid_amount = it.amount;
      item.paid_date = p.purchaseDate;
    }
    return item;
  });
  return { ...base, items, total: p.amount + base.fee, firstDue: dates[0] };
}

/** Plan kind for a generated split: Pay-in-4 when 4 parts with part 1 at purchase, otherwise BNPL. */
export function splitKind(parts: number, firstAtPurchase: boolean): "pay_in_4" | "bnpl" {
  return parts === 4 && firstAtPurchase ? "pay_in_4" : "bnpl";
}
