import { toast } from "sonner";
import { usePlans } from "../store/usePlans";
import { useUI } from "../store/useUI";
import { buildStatements, type StatementView } from "./cycles";
import { todayISO } from "./jalali";
import type { DueItem } from "./dueItems";

/** One-click "paid" with undo toast and a celebration when the plan is finished. */
export async function quickPay(id: number, label = "قسط پرداخت شد") {
  const { planFinished, prev } = await usePlans.getState().payFull(id);
  toast.success(label, {
    duration: 6000,
    action: { label: "بازگردانی", onClick: () => void usePlans.getState().restorePayment(id, prev) },
  });
  if (planFinished) useUI.getState().celebrate(true);
}

/** Current derived view of a statement row. */
export function statementViewById(id: number): StatementView | undefined {
  const s = usePlans.getState();
  const row = s.statements.find((x) => x.id === id);
  const prov = row && s.providers.find((p) => p.id === row.provider_id);
  if (!row || !prov) return undefined;
  return buildStatements(prov, s.charges, s.statements, todayISO()).find((v) => v.id === id);
}

/** Pay the whole remaining statement amount in one click (with undo). */
export async function quickPayStatement(id: number, label = "صورتحساب پرداخت شد") {
  const v = statementViewById(id);
  if (!v) return;
  const prev = { paid_amount: v.paidAmount, paid_date: v.paidDate };
  await usePlans.getState().setStatementPayment(v, v.amount, todayISO());
  toast.success(label, {
    duration: 6000,
    action: { label: "بازگردانی", onClick: () => void usePlans.getState().setStatementPayment(v, prev.paid_amount, prev.paid_date) },
  });
}

/** "Paid" button of a DueItem row, whichever kind it is. */
export async function quickPayDue(d: DueItem) {
  if (d.kind === "statement") await quickPayStatement(d.id);
  else await quickPay(d.id);
}

/** Where clicking a DueItem should navigate. */
export function dueHref(d: DueItem): string {
  if (d.kind === "statement") return `/providers/${d.providerId}?tab=statements`;
  return `/plans/${d.planId}`;
}
