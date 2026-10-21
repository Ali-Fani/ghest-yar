import { PLAN_COLORS } from "./constants";
import { parseDecimalInput, parseIntInput } from "./digits";
import type { IntervalType } from "./schedule";
import type { FeeType, NewProvider, Provider } from "./types";

/** Editable provider settings as strings/booleans for inputs. */
export interface ProviderFormState {
  name: string;
  color: string;
  icon: string;
  creditLimit: number;
  supportsSplit: boolean;
  supportsStatement: boolean;
  parts: string;
  intervalType: IntervalType;
  intervalValue: string;
  firstAtPurchase: boolean;
  feeType: FeeType;
  feeValue: string;
  closeDay: string;
  dueOffset: string;
  stFeeType: FeeType;
  stFeeValue: string;
  notes: string;
}

/** Generic defaults only: 4 parts, monthly, first part at purchase, no fee. No provider terms are hard-coded. */
export function emptyProviderForm(): ProviderFormState {
  return {
    name: "", color: PLAN_COLORS[3], icon: "card", creditLimit: 0, supportsSplit: true, supportsStatement: false,
    parts: "4", intervalType: "monthly", intervalValue: "1", firstAtPurchase: true, feeType: "none", feeValue: "0",
    closeDay: "30", dueOffset: "10", stFeeType: "none", stFeeValue: "0", notes: "",
  };
}

export function providerToForm(p: Provider): ProviderFormState {
  return {
    name: p.name, color: p.color, icon: p.icon, creditLimit: p.credit_limit ?? 0, supportsSplit: !!p.supports_split,
    supportsStatement: !!p.supports_statement, parts: String(p.preset_parts), intervalType: p.preset_interval_type,
    intervalValue: String(p.preset_interval_value), firstAtPurchase: !!p.preset_first_at_purchase, feeType: p.preset_fee_type,
    feeValue: String(p.preset_fee_value), closeDay: String(p.statement_close_day ?? 30), dueOffset: String(p.statement_due_offset ?? 10),
    stFeeType: p.statement_fee_type, stFeeValue: String(p.statement_fee_value), notes: p.notes ?? "",
  };
}

const dec = (s: string) => {
  const n = parseDecimalInput(s);
  return Number.isNaN(n) ? 0 : n;
};

export function providerFormErrors(f: ProviderFormState) {
  const parts = parseIntInput(f.parts);
  const close = parseIntInput(f.closeDay);
  const off = parseIntInput(f.dueOffset);
  return {
    name: !f.name.trim() ? "نام را وارد کنید" : "",
    mode: !f.supportsSplit && !f.supportsStatement ? "حداقل یکی از دو حالت را فعال کنید" : "",
    parts: f.supportsSplit && (parts < 1 || parts > 36) ? "تعداد اقساط معتبر نیست" : "",
    closeDay: f.supportsStatement && (close < 1 || close > 31) ? "روز بستن باید بین ۱ تا ۳۱ باشد" : "",
    dueOffset: f.supportsStatement && off > 90 ? "حداکثر ۹۰ روز" : "",
  };
}

export function formToProvider(f: ProviderFormState, archived = 0): NewProvider {
  const fv = (t: FeeType, v: string) => (t === "none" ? 0 : t === "fixed" ? Math.round(dec(v)) : dec(v));
  return {
    name: f.name.trim(),
    color: f.color,
    icon: f.icon,
    credit_limit: f.creditLimit > 0 ? f.creditLimit : null,
    supports_split: f.supportsSplit ? 1 : 0,
    supports_statement: f.supportsStatement ? 1 : 0,
    preset_parts: Math.max(1, parseIntInput(f.parts) || 4),
    preset_interval_type: f.intervalType,
    preset_interval_value: Math.max(1, parseIntInput(f.intervalValue) || 1),
    preset_first_at_purchase: f.firstAtPurchase ? 1 : 0,
    preset_fee_type: f.feeType,
    preset_fee_value: fv(f.feeType, f.feeValue),
    statement_close_day: f.supportsStatement ? Math.min(31, Math.max(1, parseIntInput(f.closeDay) || 30)) : null,
    statement_due_offset: f.supportsStatement ? parseIntInput(f.dueOffset) : null,
    statement_fee_type: f.stFeeType,
    statement_fee_value: fv(f.stFeeType, f.stFeeValue),
    notes: f.notes.trim() || null,
    archived,
  };
}
