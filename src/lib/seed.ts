import { addDaysISO, addJalaliMonthsISO, todayISO } from "./jalali";
import { generateSchedule } from "./schedule";
import { usePlans } from "../store/usePlans";
import { presetOf } from "./purchase";
import { emptyProviderForm, formToProvider } from "./providerForm";
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

  await seedProviders();
}

/** Demo providers (dev only): split purchases and statement charges over a few cycles. */
/** Let React render between store updates (the in-memory repo resolves synchronously, which trips the nested-update limit). */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function seedProviders() {
  const store = usePlans.getState();
  const today = todayISO();
  const mk = (over: Partial<ReturnType<typeof emptyProviderForm>>) => formToProvider({ ...emptyProviderForm(), ...over });

  const snapId = await store.createProvider(
    mk({ name: "اسنپ‌پی", color: "#10b981", icon: "card", creditLimit: 10_000_000, supportsSplit: true, supportsStatement: false }),
  );
  const digiId = await store.createProvider(
    mk({ name: "دیجی‌پی", color: "#f43f5e", icon: "receipt", creditLimit: 20_000_000, supportsSplit: true, supportsStatement: true, closeDay: "25", dueOffset: "10", parts: "3", firstAtPurchase: false }),
  );
  const taraId = await store.createProvider(
    mk({ name: "تارا", color: "#a855f7", icon: "wallet", creditLimit: 6_000_000, supportsSplit: false, supportsStatement: true, closeDay: "31", dueOffset: "7", stFeeType: "percent", stFeeValue: "2" }),
  );

  const snap = usePlans.getState().providers.find((p) => p.id === snapId)!;
  const digi = usePlans.getState().providers.find((p) => p.id === digiId)!;
  const buys: [typeof snap, number, string, number][] = [
    [snap, 4_000_000, "فروشگاه کتاب", -12],
    [snap, 2_400_000, "رستوران", -3],
    [snap, 3_200_000, "لوازم ورزشی", 0],
    [digi, 9_000_000, "گوشی موبایل", -20],
  ];
  for (const [p, amount, label, offset] of buys) {
    const id = await store.addSplitPurchase(p, { ...presetOf(p), amount, date: addDaysISO(today, offset), title: label, store: label });
    // A few earlier parts are already paid so the pages look lived-in.
    const items = usePlans.getState().installments.filter((i) => i.plan_id === id && i.paid_amount === 0 && i.due_date < today);
    for (const it of items) {
      await store.payFull(it.id, it.due_date);
      await tick();
    }
    await tick();
  }

  const charge = async (providerId: number, offset: number, amount: number, label: string) => {
    await store.addCharge({ provider_id: providerId, date: addDaysISO(today, offset), amount, store: label, title: label, note: null });
    await tick();
  };
  for (const [offset, amount, label] of [[-70, 850_000, "سوپرمارکت"], [-62, 420_000, "داروخانه"], [-48, 1_300_000, "لباس"], [-41, 260_000, "کافه"],
    [-30, 980_000, "لوازم خانه"], [-22, 540_000, "تاکسی اینترنتی"], [-9, 730_000, "سوپرمارکت"], [-4, 3_100_000, "لوازم برقی"], [-1, 190_000, "کافه"]] as const) {
    await charge(digiId, offset, amount, label);
  }
  for (const [offset, amount, label] of [[-55, 700_000, "نانوایی"], [-33, 1_450_000, "شارژ و اینترنت"], [-15, 620_000, "رستوران"], [-6, 880_000, "سوپرمارکت"], [-2, 340_000, "کافه"]] as const) {
    await charge(taraId, offset, amount, label);
  }
  // Pay the oldest closed digipay statement so the list shows a paid one too.
  const { statements, charges, providers } = usePlans.getState();
  const { buildStatements } = await import("./cycles");
  const dp = providers.find((p) => p.id === digiId)!;
  const closed = buildStatements(dp, charges, statements, today).filter((v) => v.state !== "open").sort((a, b) => a.start.localeCompare(b.start));
  if (closed[0]) await store.setStatementPayment(closed[0], closed[0].amount, closed[0].dueDate < today ? closed[0].dueDate : today);
}
