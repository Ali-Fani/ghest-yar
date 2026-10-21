import type { DueItem } from "./dueItems";
import { formatTomanCompact } from "./money";
import type { Provider } from "./types";

export type CreditTone = "ok" | "warn" | "danger";

export interface CreditUsage {
  used: number;
  limit: number | null;
  /** 0..100+ (not clamped above 100); 0 without a limit */
  percent: number;
  tone: CreditTone;
}

export function creditTone(percent: number): CreditTone {
  return percent >= 100 ? "danger" : percent >= 80 ? "warn" : "ok";
}

/**
 * Credit used = unpaid installments of the provider's plans
 *             + unpaid amount of its closed statements
 *             + the open cycle's charges.
 * `items` are the provider's DueItems (already without archived plans and converted statements).
 */
export function creditUsage(limit: number | null | undefined, items: DueItem[]): CreditUsage {
  let used = 0;
  for (const d of items) {
    if (d.paid) continue;
    used += d.kind === "statement" && d.open ? (d.chargesTotal ?? d.amount) : d.remaining;
  }
  const lim = limit && limit > 0 ? limit : null;
  const percent = lim ? (used / lim) * 100 : 0;
  return { used, limit: lim, percent, tone: creditTone(percent) };
}

export function providerCreditUsage(provider: Pick<Provider, "id" | "credit_limit">, all: DueItem[]): CreditUsage {
  return creditUsage(provider.credit_limit, all.filter((d) => d.providerId === provider.id));
}

/** «۶٫۲ از ۱۰ میلیون»: the unit is shown once when both amounts share it. */
export function formatUsage(used: number, limit: number): string {
  const u = formatTomanCompact(used);
  const l = formatTomanCompact(limit);
  const ui = u.lastIndexOf(" ");
  const li = l.lastIndexOf(" ");
  if (ui > 0 && li > 0 && u.slice(ui) === l.slice(li)) return `${u.slice(0, ui)} از ${l}`;
  return `${u} از ${l}`;
}

export interface ProviderSummary {
  /** Everything still owed: unpaid installments + statements (open cycle included). */
  outstanding: number;
  /** Earliest unpaid due item (an open statement counts, with its due date). */
  next: DueItem | null;
  overdueCount: number;
  usage: CreditUsage;
}

export function summarizeProvider(provider: Pick<Provider, "id" | "credit_limit">, all: DueItem[], today: string): ProviderSummary {
  const mine = all.filter((d) => d.providerId === provider.id);
  const unpaid = mine.filter((d) => !d.paid);
  return {
    outstanding: unpaid.reduce((s, d) => s + d.remaining, 0),
    next: unpaid[0] ?? null,
    overdueCount: unpaid.filter((d) => !d.open && d.dueDate < today).length,
    usage: creditUsage(provider.credit_limit, mine),
  };
}
