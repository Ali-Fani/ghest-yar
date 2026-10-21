import { addDaysISO, addJalaliMonthsISO, todayISO } from "./jalali";
import { generateSchedule } from "./schedule";
import { usePlans } from "../store/usePlans";
import type { NewPlan } from "./types";

/** Demo data (dev only). */
export async function seedDemo() {
  const store = usePlans.getState();
  const today = todayISO();
  const base: Omit<NewPlan, "title" | "direction" | "total_amount" | "installment_count" | "installment_amount" | "start_date" | "color" | "icon"> = {
    counterparty: null, category: null, down_payment: 0, profit_rate: 0, interval_type: "monthly", interval_value: 1, notes: null, archived: 0,
    kind: "loan", provider_id: null, store: null, purchase_date: null, fee_type: "none", fee_value: 0,
  };
  const defs = [
    { title: "وام خرید مسکن", counterparty: "بانک ملی", category: "وام بانکی", total: 600_000_000, down: 0, rate: 18, n: 24, start: addJalaliMonthsISO(today, -6), color: "#6366f1", icon: "home", dir: "payable" as const, paid: 6 },
    { title: "لپ‌تاپ ایسوس", counterparty: "دیجی‌کالا", category: "خرید قسطی", total: 85_000_000, down: 15_000_000, rate: 0, n: 10, start: addJalaliMonthsISO(today, -3), color: "#0ea5e9", icon: "laptop", dir: "payable" as const, paid: 2 },
    { title: "خودرو", counterparty: "ایران‌خودرو", category: "خودرو", total: 450_000_000, down: 100_000_000, rate: 12, n: 36, start: addDaysISO(today, 2), color: "#f59e0b", icon: "car", dir: "payable" as const, paid: 0 },
    { title: "قرض به علی", counterparty: "علی رضایی", category: "شخصی", total: 30_000_000, down: 0, rate: 0, n: 6, start: addJalaliMonthsISO(today, -1), color: "#14b8a6", icon: "user", dir: "receivable" as const, paid: 1 },
    { title: "گوشی موبایل", counterparty: "فروشگاه پارسیان", category: "خرید قسطی", total: 40_000_000, down: 10_000_000, rate: 0, n: 3, start: addJalaliMonthsISO(today, -3), color: "#ec4899", icon: "smartphone", dir: "payable" as const, paid: 3 },
  ];
  for (const d of defs) {
    const sch = generateSchedule({ totalAmount: d.total, downPayment: d.down, profitRate: d.rate, count: d.n, intervalType: "monthly", intervalValue: 1, startDate: d.start });
    const id = await store.createPlan(
      { ...base, title: d.title, direction: d.dir, counterparty: d.counterparty, category: d.category, total_amount: d.total, down_payment: d.down, profit_rate: d.rate, installment_count: d.n, installment_amount: sch.installmentAmount, start_date: d.start, color: d.color, icon: d.icon },
      sch.items,
    );
    const items = usePlans.getState().installments.filter((i) => i.plan_id === id).sort((a, b) => a.seq - b.seq);
    for (const it of items.slice(0, d.paid)) await store.payFull(it.id, it.due_date);
  }
}
