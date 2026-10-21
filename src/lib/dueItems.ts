import { buildStatements, type StatementState, type StatementView } from "./cycles";
import { diffDays } from "./jalali";
import { statusOf, type InstallmentStatus } from "./status";
import type { Charge, Direction, Installment, Plan, PlanKind, Provider, Statement } from "./types";

/**
 * One thing that has to be paid on a date: either an installment of a plan or a provider's statement.
 * Dashboard, calendar, reminders, badges, reports, CSV and search all consume DueItem[].
 */
export interface DueItem {
  /** Unique across kinds: `i:12` / `s:5`. */
  key: string;
  kind: "installment" | "statement";
  /** installment id or statement row id */
  id: number;
  providerId: number | null;
  providerName: string | null;
  planId: number | null;
  planKind: PlanKind | null;
  title: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  paid: boolean;
  remaining: number;
  status: InstallmentStatus;
  direction: Direction;
  category: string | null;
  color: string;
  icon: string;
  /** installments: sequence in the plan and the plan's count */
  seq?: number;
  count?: number;
  /** statements: the cycle is still running (amount still growing, cannot be paid yet) */
  open?: boolean;
  chargesTotal?: number;
  closeDate?: string;
  statementState?: StatementState;
}

export const STATEMENT_CATEGORY = "صورتحساب اعتباری";

export interface DueInput {
  plans: Plan[];
  installments: Installment[];
  providers: Provider[];
  statementViews: StatementView[];
  today: string;
  reminderDays?: number;
}

/** All statement views of all providers. */
export function buildAllStatements(providers: Provider[], charges: Charge[], rows: Statement[], today: string): StatementView[] {
  return providers.flatMap((p) => buildStatements(p, charges, rows, today));
}

export function compareDue(a: DueItem, b: DueItem): number {
  return a.dueDate.localeCompare(b.dueDate) || (a.kind === b.kind ? 0 : a.kind === "installment" ? -1 : 1) || a.id - b.id;
}

/** Merge installments and statements into one list, sorted by due date. Archived plans/providers are left out. */
export function buildDueItems(input: DueInput): DueItem[] {
  const { plans, installments, providers, statementViews, today, reminderDays = 3 } = input;
  const planById = new Map(plans.map((p) => [p.id, p]));
  const provById = new Map(providers.map((p) => [p.id, p]));
  const items: DueItem[] = [];

  for (const i of installments) {
    const p = planById.get(i.plan_id);
    if (!p || p.archived) continue;
    const prov = p.provider_id != null ? provById.get(p.provider_id) : undefined;
    const paid = i.paid_amount >= i.amount;
    items.push({
      key: `i:${i.id}`,
      kind: "installment",
      id: i.id,
      providerId: p.provider_id,
      providerName: prov?.name ?? null,
      planId: p.id,
      planKind: p.kind,
      title: p.title,
      dueDate: i.due_date,
      amount: i.amount,
      paidAmount: i.paid_amount,
      paid,
      remaining: Math.max(0, i.amount - i.paid_amount),
      status: statusOf(i, today, reminderDays),
      direction: p.direction,
      category: p.category,
      color: p.color,
      icon: p.icon,
      seq: i.seq,
      count: p.installment_count,
    });
  }

  for (const v of statementViews) {
    const prov = provById.get(v.providerId);
    if (!prov || prov.archived || v.id == null || v.splitPlanId != null || v.amount <= 0) continue;
    const open = v.state === "open";
    const paid = v.state === "paid";
    const input = { amount: v.amount, paid_amount: v.paidAmount, due_date: v.dueDate };
    items.push({
      key: `s:${v.id}`,
      kind: "statement",
      id: v.id,
      providerId: prov.id,
      providerName: prov.name,
      planId: null,
      planKind: null,
      title: `صورتحساب ${prov.name}`,
      dueDate: v.dueDate,
      amount: v.amount,
      paidAmount: v.paidAmount,
      paid,
      remaining: v.remaining,
      status: open ? "upcoming" : statusOf(input, today, reminderDays),
      direction: "payable",
      category: STATEMENT_CATEGORY,
      color: prov.color,
      icon: prov.icon,
      open,
      chargesTotal: v.chargesTotal,
      closeDate: v.end,
      statementState: v.state,
    });
  }
  return items.sort(compareDue);
}

export const isDueOverdue = (d: DueItem, today: string) => !d.paid && !d.open && d.dueDate < today;
/** Can be paid right now (not already paid and, for statements, the cycle is closed). */
export const isPayable = (d: DueItem) => !d.paid && !d.open;
export const daysUntil = (d: DueItem, today: string) => diffDays(d.dueDate, today);

export interface DueGroup {
  /** Several same-day installments of one provider (length >= 2) or a single item. */
  key: string;
  items: DueItem[];
  providerId: number | null;
  dueDate: string;
  total: number;
}

/**
 * Group same-day installments of the same provider into one row («۳ قسط اسنپ‌پی»).
 * Statements and installments without a provider stay single. Order of first appearance is kept.
 */
export function groupByProviderDay(items: DueItem[]): DueGroup[] {
  const out: DueGroup[] = [];
  const index = new Map<string, DueGroup>();
  for (const it of items) {
    if (it.kind === "installment" && it.providerId != null) {
      const k = `${it.providerId}|${it.dueDate}`;
      const g = index.get(k);
      if (g) {
        g.items.push(it);
        g.total += it.remaining;
      } else {
        const ng: DueGroup = { key: k, items: [it], providerId: it.providerId, dueDate: it.dueDate, total: it.remaining };
        index.set(k, ng);
        out.push(ng);
      }
    } else {
      out.push({ key: it.key, items: [it], providerId: it.providerId, dueDate: it.dueDate, total: it.remaining });
    }
  }
  return out;
}
