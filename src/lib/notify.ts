import { isTauri } from "./db";
import { formatToman, formatTomanCompact } from "./money";
import { toFaDigits } from "./digits";
import { diffDays, todayISO } from "./jalali";
import { buildAllStatements, buildDueItems, isPayable, type DueItem } from "./dueItems";
import type { StatementView } from "./cycles";
import type { Provider } from "./types";
import { usePlans } from "../store/usePlans";
import { useSettings } from "../store/useSettings";

/** «تا ۲ روز دیگر» / «امروز» / «فردا» / «معوق» */
function whenLabel(dueDate: string, today: string): string {
  const n = diffDays(dueDate, today);
  if (n < 0) return "معوق";
  if (n === 0) return "امروز";
  if (n === 1) return "فردا";
  return `تا ${toFaDigits(n)} روز دیگر`;
}

/** Pure: build the reminder text for the given due items (and optional close-day heads-ups). */
export function composeReminder(
  items: DueItem[],
  today: string,
  reminderDays: number,
  closing: { provider: Provider; view: StatementView }[] = [],
) {
  const due = items.filter((i) => i.direction === "payable" && isPayable(i) && diffDays(i.dueDate, today) <= reminderDays);
  const installments = due.filter((i) => i.kind === "installment");
  const statements = due.filter((i) => i.kind === "statement");
  if (!due.length && !closing.length) return null;

  const lines: string[] = [];
  if (installments.length) {
    const overdue = installments.filter((i) => i.dueDate < today);
    const soon = installments.filter((i) => i.dueDate >= today);
    const sum = installments.reduce((s, i) => s + i.remaining, 0);
    const parts: string[] = [];
    if (overdue.length) parts.push(`${toFaDigits(overdue.length)} قسط معوق`);
    if (soon.length) parts.push(`${toFaDigits(soon.length)} قسط تا ${toFaDigits(reminderDays)} روز آینده سررسید دارد`);
    lines.push(`${parts.join(" و ")} — مجموع ${formatToman(sum)}`);
  }
  for (const s of statements) lines.push(`${s.title} ${whenLabel(s.dueDate, today)} — ${formatTomanCompact(s.remaining)}`);
  for (const c of closing) lines.push(`صورتحساب ${c.provider.name} فردا بسته می‌شود — ${formatTomanCompact(c.view.amount)}`);

  const signature = [
    ...due.map((i) => i.key).sort(),
    ...closing.map((c) => `close:${c.view.key}`).sort(),
  ].join(",");
  return { body: lines.join("\n"), signature };
}

/** Build the grouped message for unpaid installments and statements that are overdue or due within the window. */
export function buildReminder(today = todayISO()) {
  const { plans, installments, providers, charges, statements } = usePlans.getState();
  const { reminderDays, closeHeadsUp } = useSettings.getState();
  const views = buildAllStatements(providers, charges, statements, today);
  const items = buildDueItems({ plans, installments, providers, statementViews: views, today, reminderDays });
  const closing: { provider: Provider; view: StatementView }[] = [];
  if (closeHeadsUp) {
    for (const v of views) {
      const provider = providers.find((p) => p.id === v.providerId);
      if (provider && !provider.archived && v.state === "open" && v.amount > 0 && diffDays(v.end, today) === 1) closing.push({ provider, view: v });
    }
  }
  return composeReminder(items, today, reminderDays, closing);
}

/** Send at most one grouped notification per day for the same set of items. */
export async function checkReminders(force = false): Promise<boolean> {
  const st = useSettings.getState();
  if (!st.notifications && !force) return false;
  const today = todayISO();
  const r = buildReminder(today);
  if (!r) return false;
  const key = `${today}|${r.signature}`;
  if (!force && st.getRaw("last_notified") === key) return false;
  if (!isTauri()) {
    await st.setRaw("last_notified", key);
    return false;
  }
  try {
    const n = await import("@tauri-apps/plugin-notification");
    let granted = await n.isPermissionGranted();
    if (!granted) granted = (await n.requestPermission()) === "granted";
    if (!granted) return false;
    n.sendNotification({ title: "قسط‌یار", body: r.body });
    await st.setRaw("last_notified", key);
    return true;
  } catch (e) {
    console.error("notification failed", e);
    return false;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startReminderLoop() {
  if (timer) return;
  if (useSettings.getState().launchCheck) void checkReminders();
  timer = setInterval(() => void checkReminders(), 60 * 60 * 1000);
}
