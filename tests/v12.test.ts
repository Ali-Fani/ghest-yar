import { describe, expect, it } from "vitest";
import { addDaysISO, jalaliToISO, toJalali } from "../src/lib/jalali";
import { dueDates, feeAmount, generateSchedule, generateSplit, splitKind } from "../src/lib/schedule";
import {
  buildStatements, cycleFor, dueDateFor, nextCycle, planStatementSync, statementFee, statementForPurchase, statementState,
} from "../src/lib/cycles";
import { buildAllStatements, buildDueItems, compareDue, groupByProviderDay, isPayable, type DueItem } from "../src/lib/dueItems";
import { creditTone, creditUsage, formatUsage, providerCreditUsage } from "../src/lib/creditUsage";
import { composeReminder } from "../src/lib/notify";
import { validateBackup } from "../src/lib/backup";
import { getRepo, resetRepoForTests, withProviderDefaults } from "../src/lib/db";
import type { Charge, Installment, Plan, Provider, Statement } from "../src/lib/types";

const J = (y: number, m: number, d: number) => jalaliToISO(y, m, d);
const parts = (iso: string) => {
  const j = toJalali(iso);
  return [j.y, j.m, j.d];
};

/* -------------------------------- cycles -------------------------------- */

describe("cycles", () => {
  it("finds the cycle a date falls in", () => {
    const c = cycleFor(J(1405, 8, 20), 25);
    expect(parts(c.start)).toEqual([1405, 7, 26]);
    expect(parts(c.end)).toEqual([1405, 8, 25]);
    // the close day itself belongs to the closing cycle, the day after to the next one
    expect(parts(cycleFor(J(1405, 8, 25), 25).end)).toEqual([1405, 8, 25]);
    const n = cycleFor(J(1405, 8, 26), 25);
    expect(parts(n.start)).toEqual([1405, 8, 26]);
    expect(parts(n.end)).toEqual([1405, 9, 25]);
  });

  it("clamps close day 31 to the month length", () => {
    const mehr = cycleFor(J(1405, 7, 15), 31);
    expect(parts(mehr.end)).toEqual([1405, 7, 30]); // Mehr has 30 days
    expect(parts(mehr.start)).toEqual([1405, 7, 1]); // Shahrivar closed on the 31st
    const aban = cycleFor(J(1405, 8, 1), 31);
    expect(parts(aban.start)).toEqual([1405, 8, 1]);
    expect(parts(aban.end)).toEqual([1405, 8, 30]);
    expect(parts(cycleFor(J(1405, 1, 10), 31).end)).toEqual([1405, 1, 31]);
  });

  it("handles Esfand in leap and non-leap years", () => {
    expect(parts(cycleFor(J(1405, 12, 10), 30).end)).toEqual([1405, 12, 29]); // 1405 is not leap
    expect(parts(cycleFor(J(1403, 12, 10), 30).end)).toEqual([1403, 12, 30]); // 1403 is leap
    const c = cycleFor(J(1406, 1, 5), 30);
    expect(parts(c.start)).toEqual([1406, 1, 1]); // day after Esfand's close
    expect(parts(c.end)).toEqual([1406, 1, 30]);
  });

  it("chains cycles with no gaps or overlaps", () => {
    let c = cycleFor(J(1405, 11, 3), 30);
    for (let k = 0; k < 14; k++) {
      const n = nextCycle(c, 30);
      expect(n.start).toBe(addDaysISO(c.end, 1));
      expect(n.end > c.end).toBe(true);
      c = n;
    }
  });

  it("due date = close + offset, across month and year boundaries", () => {
    expect(parts(dueDateFor(cycleFor(J(1405, 8, 20), 25), 10))).toEqual([1405, 9, 5]); // 25 Aban + 10 = 5 Azar
    expect(parts(dueDateFor(cycleFor(J(1405, 12, 20), 29), 5))).toEqual([1406, 1, 5]);
    expect(dueDateFor(cycleFor(J(1405, 8, 20), 25), 0)).toBe(J(1405, 8, 25));
  });

  it("explains a purchase: date -> statement -> due date", () => {
    const r = statementForPurchase(J(1405, 8, 20), 25, 10);
    expect(parts(r.closeDate)).toEqual([1405, 8, 25]);
    expect(parts(r.dueDate)).toEqual([1405, 9, 5]);
  });
});

/* ------------------------------ statement fee / state ------------------------------ */

describe("statement fee and state machine", () => {
  it("computes fixed, percent (rounded to 1,000) and none", () => {
    expect(statementFee(10_000_000, "none", 5)).toBe(0);
    expect(statementFee(10_000_000, "fixed", 150_000)).toBe(150_000);
    expect(statementFee(10_000_000, "percent", 3)).toBe(300_000);
    expect(statementFee(1_234_567, "percent", 3)).toBe(37_000); // 37,037 -> 37,000
    expect(statementFee(0, "fixed", 150_000)).toBe(0);
  });

  const base = { amount: 1_000_000, paidAmount: 0, splitPlanId: null, end: J(1405, 8, 25), dueDate: J(1405, 9, 5) };
  it("transitions open -> due -> overdue, partial, paid, split", () => {
    expect(statementState(base, J(1405, 8, 10))).toBe("open");
    expect(statementState(base, J(1405, 8, 25))).toBe("open"); // close day is still in the cycle
    expect(statementState(base, J(1405, 8, 26))).toBe("due");
    expect(statementState(base, J(1405, 9, 5))).toBe("due");
    expect(statementState(base, J(1405, 9, 6))).toBe("overdue");
    expect(statementState({ ...base, paidAmount: 400_000 }, J(1405, 9, 6))).toBe("partial");
    expect(statementState({ ...base, paidAmount: 1_000_000 }, J(1405, 9, 6))).toBe("paid");
    expect(statementState({ ...base, splitPlanId: 7 }, J(1405, 8, 10))).toBe("split");
    expect(statementState({ ...base, splitPlanId: 7, paidAmount: 1_000_000 }, J(1405, 9, 6))).toBe("split");
  });
});

/* ------------------------------ buildStatements ------------------------------ */

const prov = (over: Partial<Provider> = {}): Provider =>
  withProviderDefaults({ id: 1, name: "دیجی‌پی", supports_statement: 1, statement_close_day: 25, statement_due_offset: 10, ...over });
const charge = (id: number, date: string, amount: number, over: Partial<Charge> = {}): Charge => ({
  id, provider_id: 1, date, amount, store: null, title: null, note: null, created_at: "2000-01-01T00:00:00.000Z", ...over,
});
const row = (id: number, start: string, end: string, over: Partial<Statement> = {}): Statement => ({
  id, provider_id: 1, period_start: start, period_end: end, due_date: dueDateFor({ start, end }, 10),
  paid_amount: 0, paid_date: null, split_plan_id: null, note: null, ...over,
});

describe("buildStatements", () => {
  const today = J(1405, 8, 28);
  const c1 = cycleFor(J(1405, 8, 10), 25); // 26 Mehr .. 25 Aban
  const c2 = cycleFor(J(1405, 8, 28), 25); // 26 Aban .. 25 Azar

  it("groups charges by cycle, newest statement first, and always shows the current cycle", () => {
    const charges = [charge(1, J(1405, 8, 10), 300_000), charge(2, J(1405, 8, 20), 200_000), charge(3, J(1405, 8, 27), 90_000)];
    const v = buildStatements(prov(), charges, [], today);
    expect(v.map((x) => [x.start, x.chargesTotal])).toEqual([[c2.start, 90_000], [c1.start, 500_000]]);
    expect(v[0].state).toBe("open");
    expect(v[1].state).toBe("due");
    expect(v[1].dueDate).toBe(dueDateFor(c1, 10));
    const empty = buildStatements(prov(), [], [], today);
    expect(empty).toHaveLength(1);
    expect(empty[0].state).toBe("open");
    expect(empty[0].amount).toBe(0);
  });

  it("adds the statement fee to the amount", () => {
    const v = buildStatements(prov({ statement_fee_type: "percent", statement_fee_value: 2 }), [charge(1, J(1405, 8, 10), 1_000_000)], [], today);
    expect(v[1].fee).toBe(20_000);
    expect(v[1].amount).toBe(1_020_000);
    expect(v[1].remaining).toBe(1_020_000);
  });

  it("folds a backdated charge into its own cycle and reopens a paid statement", () => {
    const paidRow = row(5, c1.start, c1.end, { paid_amount: 500_000, paid_date: J(1405, 8, 26) });
    const before = buildStatements(prov(), [charge(1, J(1405, 8, 10), 500_000)], [paidRow], today);
    expect(before.find((x) => x.start === c1.start)!.state).toBe("paid");
    // new charge dated inside the paid cycle, but created after the payment
    const late = charge(2, J(1405, 8, 12), 100_000, { created_at: "2099-01-01T00:00:00.000Z" });
    const after = buildStatements(prov(), [charge(1, J(1405, 8, 10), 500_000), late], [paidRow], today);
    const s = after.find((x) => x.start === c1.start)!;
    expect(s.amount).toBe(600_000);
    expect(s.state).toBe("partial");
    expect(s.remaining).toBe(100_000);
    expect(s.reopened).toBe(true);
  });

  it("marks a converted statement as split with nothing remaining", () => {
    const v = buildStatements(prov(), [charge(1, J(1405, 8, 10), 500_000)], [row(5, c1.start, c1.end, { split_plan_id: 9 })], today);
    const s = v.find((x) => x.start === c1.start)!;
    expect(s.state).toBe("split");
    expect(s.remaining).toBe(0);
  });

  it("plans row creation for cycles without a row", () => {
    const charges = [charge(1, J(1405, 8, 10), 500_000), charge(2, J(1405, 8, 27), 90_000)];
    const r1 = row(5, c1.start, c1.end, { due_date: "2000-01-01" });
    const views = buildStatements(prov(), charges, [r1], today);
    const plan = planStatementSync(views, [r1]);
    expect(plan.create.map((x) => x.period_start)).toEqual([c2.start]);
    expect(plan.staleDue).toEqual([{ id: 5, due_date: dueDateFor(c1, 10) }]);
  });
});

/* ------------------------------ split purchases ------------------------------ */

describe("generateSplit", () => {
  const purchaseDate = J(1405, 8, 10);
  const mk = (over: object = {}) =>
    generateSplit({ amount: 4_000_000, parts: 4, intervalType: "monthly", intervalValue: 1, firstAtPurchase: true, purchaseDate, ...over });

  it("Pay-in-4: part 1 is due on the purchase date and auto-paid", () => {
    const r = mk();
    expect(r.items.map((i) => i.amount)).toEqual([1_000_000, 1_000_000, 1_000_000, 1_000_000]);
    expect(r.items[0].due_date).toBe(purchaseDate);
    expect(r.items[0].paid_amount).toBe(1_000_000);
    expect(r.items[0].paid_date).toBe(purchaseDate);
    expect(r.items[1].paid_amount).toBeUndefined();
    expect(parts(r.items[1].due_date)).toEqual([1405, 9, 10]);
    expect(parts(r.items[3].due_date)).toEqual([1405, 11, 10]);
    expect(splitKind(4, true)).toBe("pay_in_4");
    expect(splitKind(4, false)).toBe("bnpl");
    expect(splitKind(3, true)).toBe("bnpl");
  });

  it("without first-at-purchase everything starts one interval later and is unpaid", () => {
    const r = mk({ firstAtPurchase: false });
    expect(parts(r.items[0].due_date)).toEqual([1405, 9, 10]);
    expect(parts(r.items[3].due_date)).toEqual([1405, 12, 10]);
    expect(r.items.every((i) => i.paid_amount === undefined)).toBe(true);
    expect(r.firstDue).toBe(r.items[0].due_date);
  });

  it("spreads a percent fee equally and keeps the sum exact", () => {
    const r = mk({ amount: 10_000_000, feeType: "percent", feeValue: 5 });
    expect(r.fee).toBe(500_000);
    expect(r.total).toBe(10_500_000);
    expect(r.items.map((i) => i.amount)).toEqual([2_625_000, 2_625_000, 2_625_000, 2_625_000]);
  });

  it("puts the rounding remainder on the last part", () => {
    const r = generateSplit({ amount: 1_000_000, parts: 3, intervalType: "monthly", intervalValue: 1, firstAtPurchase: true, purchaseDate });
    expect(r.items.map((i) => i.amount)).toEqual([333_000, 333_000, 334_000]);
    const f = generateSplit({ amount: 1_000_000, parts: 3, intervalType: "monthly", intervalValue: 1, firstAtPurchase: true, purchaseDate, feeType: "fixed", feeValue: 100_000 });
    expect(f.items.map((i) => i.amount)).toEqual([367_000, 367_000, 366_000]);
    expect(f.items.reduce((s, i) => s + i.amount, 0)).toBe(1_100_000);
  });

  it("amounts always sum to amount + fee", () => {
    for (const amount of [123_457, 999_999, 5_555_555, 1_000_000_001]) {
      for (const parts of [2, 3, 4, 6, 7]) {
        for (const [feeType, feeValue] of [["none", 0], ["fixed", 45_678], ["percent", 3.7]] as const) {
          const r = generateSplit({ amount, parts, intervalType: "monthly", intervalValue: 1, firstAtPurchase: true, purchaseDate, feeType, feeValue });
          expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(amount + feeAmount(amount, feeType, feeValue));
          expect(r.items).toHaveLength(parts);
        }
      }
    }
  });

  it("supports weekly and 14-day intervals", () => {
    const w = mk({ intervalType: "weekly", intervalValue: 1 });
    expect(w.items.map((i) => i.due_date)).toEqual([0, 7, 14, 21].map((n) => addDaysISO(purchaseDate, n)));
    const d = mk({ intervalType: "days", intervalValue: 14 });
    expect(d.items.map((i) => i.due_date)).toEqual([0, 14, 28, 42].map((n) => addDaysISO(purchaseDate, n)));
    const dLater = mk({ intervalType: "days", intervalValue: 14, firstAtPurchase: false });
    expect(dLater.items.map((i) => i.due_date)).toEqual([14, 28, 42, 56].map((n) => addDaysISO(purchaseDate, n)));
  });

  it("keeps month-end days stable for monthly parts from the 31st", () => {
    const r = generateSplit({ amount: 400_000, parts: 4, intervalType: "monthly", intervalValue: 1, firstAtPurchase: true, purchaseDate: J(1405, 6, 31) });
    expect(r.items.map((i) => parts(i.due_date))).toEqual([[1405, 6, 31], [1405, 7, 30], [1405, 8, 30], [1405, 9, 30]]);
  });

  it("generateSchedule without a fee is unchanged, and with a fee adds it to the total", () => {
    const sc = { totalAmount: 12_000_000, downPayment: 0, profitRate: 0, count: 12, intervalType: "monthly" as const, intervalValue: 1, startDate: J(1405, 1, 1) };
    expect(generateSchedule(sc).installmentsTotal).toBe(12_000_000);
    const withFee = generateSchedule({ ...sc, feeType: "fixed", feeValue: 600_000 });
    expect(withFee.installmentsTotal).toBe(12_600_000);
    expect(withFee.totalProfit).toBe(600_000);
    expect(withFee.items).toHaveLength(dueDates(sc.startDate, 12, "monthly", 1).length);
  });
});

/* ------------------------------ due items ------------------------------ */

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: 1, title: "لپ‌تاپ", direction: "payable", counterparty: null, category: "خرید قسطی", total_amount: 1000, down_payment: 0,
  profit_rate: 0, installment_count: 2, installment_amount: 500, start_date: "2026-01-01", interval_type: "monthly", interval_value: 1,
  color: "#0ea5e9", icon: "laptop", notes: null, archived: 0, created_at: "", updated_at: "", kind: "loan", provider_id: null, store: null,
  purchase_date: null, fee_type: "none", fee_value: 0, ...over,
});
const inst = (id: number, plan_id: number, seq: number, due_date: string, amount = 500_000, paid_amount = 0): Installment => ({
  id, plan_id, seq, due_date, amount, paid_amount, paid_date: null, note: null,
});

describe("due items", () => {
  const today = J(1405, 8, 28);
  const p = prov();
  const c1 = cycleFor(J(1405, 8, 10), 25);
  const charges = [charge(1, J(1405, 8, 10), 500_000), charge(2, J(1405, 8, 27), 90_000)];
  const rows = [row(5, c1.start, c1.end), row(6, cycleFor(today, 25).start, cycleFor(today, 25).end)];
  const views = buildAllStatements([p], charges, rows, today);

  const items = buildDueItems({
    plans: [plan({ id: 1 }), plan({ id: 2, title: "آرشیو", archived: 1 }), plan({ id: 3, title: "اسنپ‌پی", provider_id: 1, kind: "pay_in_4" })],
    installments: [
      inst(10, 1, 1, J(1405, 9, 20)),
      inst(11, 1, 2, J(1405, 8, 1), 500_000, 500_000),
      inst(12, 2, 1, J(1405, 8, 1)),
      inst(13, 3, 1, dueDateFor(c1, 10)),
      inst(14, 3, 2, dueDateFor(c1, 10)),
    ],
    providers: [p],
    statementViews: views,
    today,
  });

  it("merges installments and statements sorted by due date, skipping archived plans", () => {
    expect(items.some((i) => i.planId === 2)).toBe(false);
    const dates = items.map((i) => i.dueDate);
    expect(dates).toEqual([...dates].sort());
    // same day: installments before statements
    const same = [...items].sort(compareDue);
    expect(same.map((i) => i.key)).toEqual(items.map((i) => i.key));
    const stmt = items.find((i) => i.key === "s:5")!;
    expect(stmt.kind).toBe("statement");
    expect(stmt.title).toBe("صورتحساب دیجی‌پی");
    expect(stmt.providerId).toBe(1);
    expect(stmt.amount).toBe(500_000);
    expect(stmt.status).not.toBe("paid");
  });

  it("flags the open cycle and keeps it unpayable", () => {
    const open = items.find((i) => i.key === "s:6")!;
    expect(open.open).toBe(true);
    expect(open.chargesTotal).toBe(90_000);
    expect(isPayable(open)).toBe(false);
    expect(isPayable(items.find((i) => i.key === "s:5")!)).toBe(true);
  });

  it("leaves out converted statements (their plan carries the installments)", () => {
    const v2 = buildAllStatements([p], charges, [row(5, c1.start, c1.end, { split_plan_id: 3 })], today);
    const it2 = buildDueItems({ plans: [plan({ id: 3 })], installments: [], providers: [p], statementViews: v2, today });
    expect(it2.some((i) => i.kind === "statement" && i.id === 5)).toBe(false);
  });

  it("groups same-day installments of one provider", () => {
    const g = groupByProviderDay(items.filter((i) => i.kind === "installment"));
    const grouped = g.find((x) => x.items.length === 2)!;
    expect(grouped.providerId).toBe(1);
    expect(grouped.total).toBe(1_000_000);
    expect(g.filter((x) => x.items.length === 1).length).toBe(g.length - 1);
  });
});

/* ------------------------------ credit usage ------------------------------ */

describe("credit usage", () => {
  const mkItem = (over: Partial<DueItem>): DueItem => ({
    key: "x", kind: "installment", id: 1, providerId: 1, providerName: "p", planId: 1, planKind: "pay_in_4", title: "t",
    dueDate: "2026-01-01", amount: 1_000_000, paidAmount: 0, paid: false, remaining: 1_000_000, status: "upcoming",
    direction: "payable", category: null, counterparty: null, color: "#000", icon: "card", ...over,
  });

  it("counts unpaid installments, unpaid closed statements and the open cycle's charges", () => {
    const items = [
      mkItem({ remaining: 1_000_000 }),
      mkItem({ id: 2, paid: true, remaining: 0, paidAmount: 1_000_000 }),
      mkItem({ id: 3, kind: "statement", amount: 2_000_000, remaining: 1_500_000, paidAmount: 500_000 }),
      mkItem({ id: 4, kind: "statement", open: true, amount: 1_100_000, remaining: 1_100_000, chargesTotal: 1_000_000 }),
    ];
    const u = creditUsage(10_000_000, items);
    expect(u.used).toBe(3_500_000);
    expect(u.percent).toBeCloseTo(35);
    expect(u.tone).toBe("ok");
  });

  it("goes amber at 80% and rose at 100%", () => {
    expect(creditTone(79.9)).toBe("ok");
    expect(creditTone(80)).toBe("warn");
    expect(creditTone(99.9)).toBe("warn");
    expect(creditTone(100)).toBe("danger");
    expect(creditUsage(1_000_000, [mkItem({ remaining: 800_000 })]).tone).toBe("warn");
    expect(creditUsage(1_000_000, [mkItem({ remaining: 1_200_000 })]).tone).toBe("danger");
  });

  it("has no percentage without a limit", () => {
    const u = creditUsage(null, [mkItem({})]);
    expect(u.limit).toBeNull();
    expect(u.percent).toBe(0);
    expect(u.used).toBe(1_000_000);
  });

  it("filters by provider and formats the label", () => {
    const items = [mkItem({ providerId: 1 }), mkItem({ id: 2, providerId: 2 })];
    expect(providerCreditUsage({ id: 1, credit_limit: 5_000_000 }, items).used).toBe(1_000_000);
    expect(formatUsage(6_200_000, 10_000_000)).toBe("۶٫۲ از ۱۰ میلیون");
    expect(formatUsage(800_000, 10_000_000)).toBe("۸۰۰ هزار از ۱۰ میلیون");
  });
});

/* ------------------------------ backup v1 -> v2 ------------------------------ */

describe("backup", () => {
  const v1 = {
    app: "ghestyar",
    version: 1,
    exported_at: "2026-01-01T00:00:00.000Z",
    plans: [
      {
        id: 4, title: "وام", direction: "payable", counterparty: "بانک", category: "وام بانکی", total_amount: 1_000_000, down_payment: 0,
        profit_rate: 0, installment_count: 2, installment_amount: 500_000, start_date: "2026-01-01", interval_type: "monthly", interval_value: 1,
        color: "#6366f1", icon: "home", notes: null, archived: 0, created_at: "t", updated_at: "t",
      },
    ],
    installments: [
      { id: 7, plan_id: 4, seq: 1, due_date: "2026-01-01", amount: 500_000, paid_amount: 500_000, paid_date: "2026-01-01", note: null },
      { id: 8, plan_id: 4, seq: 2, due_date: "2026-02-01", amount: 500_000, paid_amount: 0, paid_date: null, note: null },
    ],
    settings: { reminderDays: "5" },
  };

  it("normalizes a v1 backup to the v2 shape with defaults", () => {
    const b = validateBackup(v1);
    expect(b.version).toBe(2);
    expect(b.schemaVersion).toBe(2);
    expect(b.providers).toEqual([]);
    expect(b.charges).toEqual([]);
    expect(b.statements).toEqual([]);
    expect(b.plans[0]).toMatchObject({ kind: "loan", provider_id: null, store: null, purchase_date: null, fee_type: "none", fee_value: 0 });
    expect(b.plans[0].title).toBe("وام");
  });

  it("rejects non-backups and newer schemas", () => {
    expect(() => validateBackup({})).toThrow();
    expect(() => validateBackup({ ...v1, version: 3 })).toThrow();
  });

  it("imports a v1 backup into the store and keeps the data", async () => {
    resetRepoForTests();
    const repo = getRepo();
    await repo.init();
    await repo.importAll(validateBackup(v1));
    const d = await repo.load();
    expect(d.plans).toHaveLength(1);
    expect(d.plans[0].kind).toBe("loan");
    expect(d.installments).toHaveLength(2);
    expect(d.providers).toHaveLength(0);
    expect(d.settings.reminderDays).toBe("5");
    // new rows keep working after the import
    const pid = await repo.insertProvider({ ...withProviderDefaults({ id: 0, name: "x" }), name: "x" } as never);
    expect(pid).toBe(1);
  });

  it("round-trips a v2 backup", async () => {
    resetRepoForTests();
    const repo = getRepo();
    await repo.init();
    await repo.clearAll();
    const pid = await repo.insertProvider({ ...withProviderDefaults({ id: 0, name: "اسنپ‌پی" }) } as never);
    await repo.insertCharge({ provider_id: pid, date: "2026-01-05", amount: 100_000, store: null, title: "t", note: null });
    await repo.ensureStatement({ provider_id: pid, period_start: "2026-01-01", period_end: "2026-01-30", due_date: "2026-02-09" });
    const d = await repo.load();
    const b = validateBackup(JSON.parse(JSON.stringify({ app: "ghestyar", version: 2, schemaVersion: 2, exported_at: "", ...d })));
    await repo.importAll(b);
    const d2 = await repo.load();
    expect(d2.providers).toHaveLength(1);
    expect(d2.charges).toHaveLength(1);
    expect(d2.statements).toHaveLength(1);
    expect(d2.providers[0].name).toBe("اسنپ‌پی");
  });
});

/* ------------------------------ reminders ------------------------------ */

describe("reminders", () => {
  const today = J(1405, 9, 3);
  const mk = (over: Partial<DueItem>): DueItem => ({
    key: "x", kind: "installment", id: 1, providerId: 1, providerName: "دیجی‌پی", planId: 1, planKind: "pay_in_4", title: "t",
    dueDate: today, amount: 1_000_000, paidAmount: 0, paid: false, remaining: 1_000_000, status: "due-soon",
    direction: "payable", category: null, counterparty: null, color: "#000", icon: "card", ...over,
  });

  it("mentions statements with their own line", () => {
    const stmt = mk({ key: "s:1", kind: "statement", id: 1, title: "صورتحساب دیجی‌پی", dueDate: J(1405, 9, 5), amount: 3_100_000, remaining: 3_100_000 });
    const r = composeReminder([stmt], today, 3)!;
    expect(r.body).toBe("صورتحساب دیجی‌پی تا ۲ روز دیگر — ۳٫۱ میلیون");
    expect(r.signature).toBe("s:1");
  });

  it("groups installments, skips open cycles and far-away items", () => {
    const items = [
      mk({ key: "i:1", id: 1 }),
      mk({ key: "i:2", id: 2, dueDate: J(1405, 9, 1) }),
      mk({ key: "s:9", kind: "statement", id: 9, open: true, dueDate: J(1405, 9, 4) }),
      mk({ key: "i:3", id: 3, dueDate: J(1405, 10, 20) }),
    ];
    const r = composeReminder(items, today, 3)!;
    expect(r.body).toContain("۱ قسط معوق و ۱ قسط تا ۳ روز آینده سررسید دارد");
    expect(r.body).not.toContain("صورتحساب");
    expect(composeReminder([items[3]], today, 3)).toBeNull();
  });

  it("adds the close-day heads-up when asked", () => {
    const view = { key: "1:a", amount: 2_000_000 } as never;
    const r = composeReminder([], today, 3, [{ provider: prov(), view }])!;
    expect(r.body).toBe("صورتحساب دیجی‌پی فردا بسته می‌شود — ۲ میلیون");
  });
});

/* ------------------------------ split plan builder ------------------------------ */

describe("buildSplitPlan", () => {
  it("builds a pay_in_4 plan from a provider preset with part 1 pre-paid", async () => {
    const { buildSplitPlan, presetOf } = await import("../src/lib/purchase");
    const p = prov({ id: 7, name: "اسنپ‌پی", supports_split: 1, color: "#10b981", icon: "card" });
    const date = J(1405, 8, 10);
    const { plan, result } = buildSplitPlan(p, { ...presetOf(p), amount: 2_400_000, date, title: "", store: "کتاب" });
    expect(plan.kind).toBe("pay_in_4");
    expect(plan.provider_id).toBe(7);
    expect(plan.title).toBe("کتاب");
    expect(plan.counterparty).toBe("اسنپ‌پی");
    expect(plan.purchase_date).toBe(date);
    expect(plan.start_date).toBe(date);
    expect(result.items[0].paid_amount).toBe(600_000);
    expect(result.items.reduce((s, i) => s + i.amount, 0)).toBe(2_400_000);
  });
});
