import { isTauri } from "./db";
import { formatToman } from "./money";
import { toFaDigits } from "./digits";
import { diffDays, todayISO } from "./jalali";
import { isPaid, remaining } from "./status";
import { usePlans } from "../store/usePlans";
import { useSettings } from "../store/useSettings";

/** Build the grouped message for unpaid installments that are overdue or due within the window. */
export function buildReminder(today = todayISO()) {
  const { installments, plans } = usePlans.getState();
  const { reminderDays } = useSettings.getState();
  const active = new Set(plans.filter((p) => !p.archived && p.direction === "payable").map((p) => p.id));
  const due = installments.filter((i) => active.has(i.plan_id) && !isPaid(i) && diffDays(i.due_date, today) <= reminderDays);
  if (!due.length) return null;
  const overdue = due.filter((i) => i.due_date < today);
  const soon = due.filter((i) => i.due_date >= today);
  const sum = due.reduce((s, i) => s + remaining(i), 0);
  const parts: string[] = [];
  if (overdue.length) parts.push(`${toFaDigits(overdue.length)} قسط معوق`);
  if (soon.length) parts.push(`${toFaDigits(soon.length)} قسط تا ${toFaDigits(reminderDays)} روز آینده سررسید دارد`);
  const body = `${parts.join(" و ")} — مجموع ${formatToman(sum)}`;
  const signature = due.map((i) => i.id).sort((a, b) => a - b).join(",");
  return { body, signature };
}

/** Send at most one grouped notification per day for the same set of installments. */
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
