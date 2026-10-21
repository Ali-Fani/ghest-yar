import { isOverdue, isPaid, remaining } from "./status";
import type { Installment, Plan } from "./types";

export interface PlanStats {
  plan: Plan;
  items: Installment[];
  total: number;
  paidCount: number;
  percent: number;
  paidSum: number;
  remainingSum: number;
  installmentsSum: number;
  next: Installment | null;
  overdueCount: number;
  overdueSum: number;
  finished: boolean;
}

export function computePlanStats(plan: Plan, all: Installment[], today: string): PlanStats {
  const items = all.filter((i) => i.plan_id === plan.id).sort((a, b) => a.seq - b.seq);
  const total = items.length;
  const paidCount = items.filter(isPaid).length;
  const paidSum = items.reduce((s, i) => s + Math.min(i.paid_amount, i.amount), 0);
  const installmentsSum = items.reduce((s, i) => s + i.amount, 0);
  const remainingSum = items.reduce((s, i) => s + remaining(i), 0);
  const unpaid = items.filter((i) => !isPaid(i)).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const overdue = items.filter((i) => isOverdue(i, today));
  return {
    plan,
    items,
    total,
    paidCount,
    percent: total ? Math.round((paidCount / total) * 100) : 0,
    paidSum,
    remainingSum,
    installmentsSum,
    next: unpaid[0] ?? null,
    overdueCount: overdue.length,
    overdueSum: overdue.reduce((s, i) => s + remaining(i), 0),
    finished: total > 0 && paidCount === total,
  };
}
