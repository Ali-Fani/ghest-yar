import { diffDays, todayISO } from "./jalali";

export type InstallmentStatus = "paid" | "partial" | "overdue" | "due-soon" | "upcoming";

export interface StatusInput {
  amount: number;
  paid_amount: number;
  due_date: string;
}

export function isPaid(i: StatusInput): boolean {
  return i.paid_amount >= i.amount;
}

export function remaining(i: StatusInput): number {
  return Math.max(0, i.amount - i.paid_amount);
}

/** Unpaid (fully or partially) and due before today. */
export function isOverdue(i: StatusInput, today: string = todayISO()): boolean {
  return !isPaid(i) && i.due_date < today;
}

/** Derived status, evaluated in order: paid, partial, overdue, due-soon, upcoming. */
export function statusOf(i: StatusInput, today: string = todayISO(), reminderDays = 3): InstallmentStatus {
  if (isPaid(i)) return "paid";
  if (i.paid_amount > 0) return "partial";
  if (i.due_date < today) return "overdue";
  if (diffDays(i.due_date, today) <= reminderDays) return "due-soon";
  return "upcoming";
}

export const STATUS_LABEL: Record<InstallmentStatus, string> = {
  paid: "پرداخت شده",
  partial: "پرداخت ناقص",
  overdue: "معوق",
  "due-soon": "سررسید نزدیک",
  upcoming: "در انتظار",
};
