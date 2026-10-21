import { addDaysISO, addJalaliMonthsISO } from "./jalali";
import { roundTo } from "./money";

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
}

export interface ScheduleItem {
  seq: number;
  due_date: string;
  amount: number;
}

export interface ScheduleResult {
  items: ScheduleItem[];
  financed: number;
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

export function generateSchedule(p: ScheduleParams): ScheduleResult {
  const n = Math.max(1, Math.floor(p.count));
  const financed = Math.max(0, p.totalAmount - p.downPayment);
  const i = periodRate(p.profitRate, p.intervalType, p.intervalValue);
  const exact = exactInstallment(financed, i, n);
  const dates = dueDates(p.startDate, n, p.intervalType, p.intervalValue);

  let regular: number;
  let last: number;
  if (p.overrideAmount != null && p.overrideAmount > 0) {
    regular = Math.round(p.overrideAmount);
    last = regular;
  } else {
    regular = roundTo(exact, 1000);
    const target = i > 0 ? Math.round(exact * n) : financed;
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
    financed,
    installmentAmount: regular,
    installmentsTotal,
    totalPayable,
    totalProfit: Math.max(0, totalPayable - p.totalAmount),
  };
}
