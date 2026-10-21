import type { IntervalType } from "./schedule";

export type Direction = "payable" | "receivable";

/** loan = وام, purchase = خرید قسطی, pay_in_4 = Pay-in-4, bnpl = BNPL, personal = شخصی */
export type PlanKind = "loan" | "purchase" | "pay_in_4" | "bnpl" | "personal";
export type FeeType = "none" | "fixed" | "percent";

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
  // v1.2
  kind: PlanKind;
  provider_id: number | null;
  store: string | null;
  purchase_date: string | null;
  fee_type: FeeType;
  fee_value: number;
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

export interface NewInstallment {
  seq: number;
  due_date: string;
  amount: number;
  /** Pre-paid on creation (e.g. part 1 of a Pay-in-4 paid at purchase). */
  paid_amount?: number;
  paid_date?: string | null;
}

/** ارائه‌دهنده: اسنپ‌پی، دیجی‌پی، بانک، فروشگاه … */
export interface Provider {
  id: number;
  name: string;
  color: string;
  icon: string;
  credit_limit: number | null;
  supports_split: number;
  supports_statement: number;
  preset_parts: number;
  preset_interval_type: IntervalType;
  preset_interval_value: number;
  preset_first_at_purchase: number;
  preset_fee_type: FeeType;
  preset_fee_value: number;
  statement_close_day: number | null;
  statement_due_offset: number | null;
  statement_fee_type: FeeType;
  statement_fee_value: number;
  notes: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

export type NewProvider = Omit<Provider, "id" | "created_at" | "updated_at">;

/** A purchase on a provider's monthly statement (mode B). */
export interface Charge {
  id: number;
  provider_id: number;
  date: string;
  amount: number;
  store: string | null;
  title: string | null;
  note: string | null;
  created_at: string;
}

export type NewCharge = Omit<Charge, "id" | "created_at">;

/** Stored part of a statement cycle: payments and the split link. The rest is derived. */
export interface Statement {
  id: number;
  provider_id: number;
  period_start: string;
  period_end: string;
  due_date: string;
  paid_amount: number;
  paid_date: string | null;
  split_plan_id: number | null;
  note: string | null;
}

export type NewStatement = Pick<Statement, "provider_id" | "period_start" | "period_end" | "due_date">;

export interface BackupFile {
  app: "ghestyar";
  /** 1 = pre-1.2 (plans + installments only), 2 = with providers/charges/statements. */
  version: number;
  schemaVersion: number;
  exported_at: string;
  plans: Plan[];
  installments: Installment[];
  providers: Provider[];
  charges: Charge[];
  statements: Statement[];
  settings: Record<string, string>;
}

export interface DataSet {
  plans: Plan[];
  installments: Installment[];
  providers: Provider[];
  charges: Charge[];
  statements: Statement[];
  settings: Record<string, string>;
}
