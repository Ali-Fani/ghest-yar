import { generateSplit, splitKind, type IntervalType, type SplitResult } from "./schedule";
import type { FeeType, NewPlan, Provider } from "./types";

export interface SplitPurchaseInput {
  amount: number;
  /** Plan title; falls back to the store, then to a generic title. */
  title?: string | null;
  store?: string | null;
  /** Purchase date (ISO). */
  date: string;
  parts: number;
  intervalType: IntervalType;
  intervalValue: number;
  firstAtPurchase: boolean;
  feeType: FeeType;
  feeValue: number;
}

/** The split settings a provider preset prescribes (mode A). */
export function presetOf(p: Provider): Pick<SplitPurchaseInput, "parts" | "intervalType" | "intervalValue" | "firstAtPurchase" | "feeType" | "feeValue"> {
  return {
    parts: p.preset_parts,
    intervalType: p.preset_interval_type,
    intervalValue: p.preset_interval_value,
    firstAtPurchase: !!p.preset_first_at_purchase,
    feeType: p.preset_fee_type,
    feeValue: p.preset_fee_value,
  };
}

/** Turn a split purchase into a normal plan plus its installments (part 1 pre-paid when it is due at purchase). */
export function buildSplitPlan(provider: Provider, input: SplitPurchaseInput): { plan: NewPlan; result: SplitResult } {
  const result = generateSplit({
    amount: input.amount, parts: input.parts, intervalType: input.intervalType, intervalValue: input.intervalValue,
    firstAtPurchase: input.firstAtPurchase, purchaseDate: input.date, feeType: input.feeType, feeValue: input.feeValue,
  });
  const store = input.store?.trim() || null;
  const plan: NewPlan = {
    title: input.title?.trim() || store || `خرید ${provider.name}`,
    direction: "payable",
    counterparty: provider.name,
    category: "خرید قسطی",
    total_amount: input.amount,
    down_payment: 0,
    profit_rate: 0,
    installment_count: input.parts,
    installment_amount: result.installmentAmount,
    start_date: result.firstDue,
    interval_type: input.intervalType,
    interval_value: input.intervalValue,
    color: provider.color,
    icon: provider.icon,
    notes: null,
    archived: 0,
    kind: splitKind(input.parts, input.firstAtPurchase),
    provider_id: provider.id,
    store,
    purchase_date: input.date,
    fee_type: input.feeType,
    fee_value: input.feeValue,
  };
  return { plan, result };
}
