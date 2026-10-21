import { addDaysISO, clampJalali, shiftMonth, toJalali } from "./jalali";
import { roundTo } from "./money";
import type { Charge, FeeType, Provider, Statement } from "./types";

export interface Cycle {
  /** First day of the cycle (ISO). */
  start: string;
  /** Close day of the cycle (ISO), inclusive. */
  end: string;
}

const clampDay = (d: number) => Math.min(31, Math.max(1, Math.floor(d) || 1));

/** The cycle that `date` falls in. A cycle closes on the Jalali `closeDay`, clamped to the month length. */
export function cycleFor(date: string, closeDay: number): Cycle {
  const cd = clampDay(closeDay);
  const j = toJalali(date);
  const thisClose = clampJalali(j.y, j.m, cd);
  const end = date <= thisClose ? { y: j.y, m: j.m } : shiftMonth(j.y, j.m, 1);
  const prev = shiftMonth(end.y, end.m, -1);
  return {
    start: addDaysISO(clampJalali(prev.y, prev.m, cd), 1),
    end: clampJalali(end.y, end.m, cd),
  };
}

/** The cycle right after `c`. */
export function nextCycle(c: Cycle, closeDay: number): Cycle {
  return cycleFor(addDaysISO(c.end, 1), closeDay);
}

/** Payment due date: close date + offset days. */
export function dueDateFor(c: Cycle, offsetDays: number): string {
  return addDaysISO(c.end, Math.max(0, Math.floor(offsetDays) || 0));
}

/** Statement fee: fixed Toman, or a percent of the charge total rounded to 1,000. Nothing for an empty statement. */
export function statementFee(chargesTotal: number, type: FeeType, value: number): number {
  if (chargesTotal <= 0 || type === "none" || !(value > 0)) return 0;
  return type === "fixed" ? Math.round(value) : roundTo((chargesTotal * value) / 100, 1000);
}

export type StatementState = "open" | "due" | "overdue" | "partial" | "paid" | "split";

export const STATEMENT_STATE_LABEL: Record<StatementState, string> = {
  open: "صورتحساب جاری",
  due: "در انتظار پرداخت",
  overdue: "معوق",
  partial: "پرداخت ناقص",
  paid: "پرداخت شده",
  split: "تقسیط شده",
};

export function statementState(
  s: { amount: number; paidAmount: number; splitPlanId: number | null; end: string; dueDate: string },
  today: string,
): StatementState {
  if (s.splitPlanId != null) return "split";
  if (today <= s.end) return "open";
  if (s.amount <= 0 || s.paidAmount >= s.amount) return "paid";
  if (s.paidAmount > 0) return "partial";
  if (s.dueDate < today) return "overdue";
  return "due";
}

/** A derived statement: charges of a cycle plus the stored payment data (if a row exists yet). */
export interface StatementView {
  /** Stable key: `${providerId}:${start}` */
  key: string;
  /** DB row id; null until the row has been created (see ensureStatements). */
  id: number | null;
  providerId: number;
  start: string;
  end: string;
  dueDate: string;
  charges: Charge[];
  chargesTotal: number;
  fee: number;
  /** chargesTotal + fee */
  amount: number;
  paidAmount: number;
  paidDate: string | null;
  splitPlanId: number | null;
  note: string | null;
  state: StatementState;
  /** Still owed on this statement itself (0 when converted to installments). */
  remaining: number;
  /** A charge was added after the statement had been paid (it fell back to "partial"). */
  reopened: boolean;
}

type StatementSettings = Pick<Provider, "statement_close_day" | "statement_due_offset" | "statement_fee_type" | "statement_fee_value"> & { id: number };

/**
 * Derive all statements of one provider, newest first.
 * - Charges fold into the stored statement that covers their date, else into the cycle computed from the close day
 *   (so backdated charges land in their own cycle, even a paid one).
 * - The current cycle is always present, even when empty.
 */
export function buildStatements(provider: StatementSettings, charges: Charge[], rows: Statement[], today: string): StatementView[] {
  const closeDay = provider.statement_close_day;
  const offset = provider.statement_due_offset ?? 0;
  const mine = charges.filter((c) => c.provider_id === provider.id);
  const myRows = rows.filter((r) => r.provider_id === provider.id);
  if (closeDay == null && myRows.length === 0) return [];

  const groups = new Map<string, { start: string; end: string; row?: Statement; charges: Charge[] }>();
  for (const r of myRows) groups.set(r.period_start, { start: r.period_start, end: r.period_end, row: r, charges: [] });

  for (const c of mine) {
    const row = myRows.find((r) => c.date >= r.period_start && c.date <= r.period_end);
    if (row) {
      groups.get(row.period_start)!.charges.push(c);
    } else if (closeDay != null) {
      const cy = cycleFor(c.date, closeDay);
      const g = groups.get(cy.start) ?? { start: cy.start, end: cy.end, charges: [] };
      g.charges.push(c);
      groups.set(cy.start, g);
    }
  }
  if (closeDay != null) {
    const cur = cycleFor(today, closeDay);
    if (!groups.has(cur.start) && !myRows.some((r) => today >= r.period_start && today <= r.period_end)) {
      groups.set(cur.start, { start: cur.start, end: cur.end, charges: [] });
    }
  }

  const out: StatementView[] = [];
  for (const g of groups.values()) {
    const row = g.row;
    const containsToday = today >= g.start && today <= g.end;
    const kept = !!row && (row.paid_amount > 0 || row.split_plan_id != null);
    if (g.charges.length === 0 && !containsToday && !kept) continue;
    const chargesTotal = g.charges.reduce((s, c) => s + c.amount, 0);
    const fee = statementFee(chargesTotal, provider.statement_fee_type, provider.statement_fee_value);
    const amount = chargesTotal + fee;
    const dueDate = dueDateFor({ start: g.start, end: g.end }, offset);
    const paidAmount = row?.paid_amount ?? 0;
    const splitPlanId = row?.split_plan_id ?? null;
    const state = statementState({ amount, paidAmount, splitPlanId, end: g.end, dueDate }, today);
    const reopened =
      state === "partial" && !!row?.paid_date && g.charges.some((c) => (c.created_at ?? "").slice(0, 10) > (row.paid_date as string));
    out.push({
      key: `${provider.id}:${g.start}`,
      id: row?.id ?? null,
      providerId: provider.id,
      start: g.start,
      end: g.end,
      dueDate,
      charges: g.charges.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
      chargesTotal,
      fee,
      amount,
      paidAmount,
      paidDate: row?.paid_date ?? null,
      splitPlanId,
      note: row?.note ?? null,
      state,
      remaining: splitPlanId != null ? 0 : Math.max(0, amount - paidAmount),
      reopened,
    });
  }
  return out.sort((a, b) => b.start.localeCompare(a.start));
}

/** Rows to create (cycles with charges that have no stored row yet) and stale due dates to refresh. */
export function planStatementSync(views: StatementView[], rows: Statement[]) {
  const create = views
    .filter((v) => v.id == null && v.charges.length > 0)
    .map((v) => ({ provider_id: v.providerId, period_start: v.start, period_end: v.end, due_date: v.dueDate }));
  const staleDue = views
    .filter((v) => v.id != null)
    .map((v) => ({ id: v.id as number, due_date: v.dueDate, row: rows.find((r) => r.id === v.id) }))
    .filter((x) => x.row && x.row.due_date !== x.due_date)
    .map((x) => ({ id: x.id, due_date: x.due_date }));
  return { create, staleDue };
}

/** Preview line for the provider settings tab / quick add: purchase date -> statement close -> due date. */
export function statementForPurchase(date: string, closeDay: number, offsetDays: number) {
  const cycle = cycleFor(date, closeDay);
  return { cycle, closeDate: cycle.end, dueDate: dueDateFor(cycle, offsetDays) };
}
