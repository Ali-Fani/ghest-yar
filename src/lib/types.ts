import type { IntervalType } from "./schedule";

export type Direction = "payable" | "receivable";

export interface Plan {
  id: number;
  title: string;
  direction: Direction;
  counterparty: string | null;
  category: string | null;
  total_amount: number;
  down_payment: number;
  profit_rate: number;
  installment_count: number;
  installment_amount: number;
  start_date: string;
  interval_type: IntervalType;
  interval_value: number;
  color: string;
  icon: string;
  notes: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

export type NewPlan = Omit<Plan, "id" | "created_at" | "updated_at">;

export interface Installment {
  id: number;
  plan_id: number;
  seq: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  paid_date: string | null;
  note: string | null;
}

export type NewInstallment = Pick<Installment, "seq" | "due_date" | "amount">;

export interface BackupFile {
  app: "ghestyar";
  version: 1;
  exported_at: string;
  plans: Plan[];
  installments: Installment[];
  settings: Record<string, string>;
}
