import { describe, expect, it } from "vitest";
import { normalizeDigits, parseDecimalInput, parseIntInput, toFaDigits } from "../src/lib/digits";
import { formatToman, formatTomanCompact, groupDigits, roundTo } from "../src/lib/money";
import { numberToPersianWords, tomanInWords } from "../src/lib/words";
import {
  addJalaliMonthsISO,
  addJalaliMonthsLib,
  formatJalaliLong,
  formatJalaliShort,
  isJalaliLeap,
  jalaliMonthLength,
  jalaliToISO,
  monthGrid,
  relativeLabel,
  shiftMonth,
  toJalali,
} from "../src/lib/jalali";
import { dueDates, generateSchedule } from "../src/lib/schedule";
import { isOverdue, statusOf } from "../src/lib/status";

describe("digits", () => {
  it("converts to Persian digits", () => {
    expect(toFaDigits(1405)).toBe("۱۴۰۵");
    expect(toFaDigits("a1b2")).toBe("a۱b۲");
  });
  it("normalizes Persian and Arabic digits", () => {
    expect(normalizeDigits("۱۲۳٤٥٦789")).toBe("123456789");
    expect(normalizeDigits("۱٬۲۰۰٫۵")).toBe("1,200.5");
  });
  it("parses ints and decimals", () => {
    expect(parseIntInput("۱۲٬۵۰۰٬۰۰۰ تومان")).toBe(12500000);
    expect(parseIntInput("")).toBe(0);
    expect(parseDecimalInput("۲۳٫۵")).toBe(23.5);
    expect(parseDecimalInput("abc")).toBeNaN();
  });
});

describe("money", () => {
  it("groups with Persian separator", () => {
    expect(groupDigits(12500000)).toBe("۱۲٬۵۰۰٬۰۰۰");
    expect(groupDigits(0)).toBe("۰");
    expect(groupDigits(-1500)).toBe("-۱٬۵۰۰");
  });
  it("formats toman", () => {
    expect(formatToman(12500000)).toBe("۱۲٬۵۰۰٬۰۰۰ تومان");
  });
  it("formats compact", () => {
    expect(formatTomanCompact(12500000)).toBe("۱۲٫۵ میلیون");
    expect(formatTomanCompact(3000000000)).toBe("۳ میلیارد");
    expect(formatTomanCompact(250000)).toBe("۲۵۰ هزار");
    expect(formatTomanCompact(500)).toBe("۵۰۰");
  });
  it("rounds to step", () => {
    expect(roundTo(3333333.3, 1000)).toBe(3333000);
    expect(roundTo(3333500, 1000)).toBe(3334000);
  });
});

describe("words", () => {
  it("converts numbers", () => {
    expect(numberToPersianWords(0)).toBe("صفر");
    expect(numberToPersianWords(15)).toBe("پانزده");
    expect(numberToPersianWords(21)).toBe("بیست و یک");
    expect(numberToPersianWords(100)).toBe("صد");
    expect(numberToPersianWords(1000)).toBe("یک هزار");
    expect(numberToPersianWords(12500000)).toBe("دوازده میلیون و پانصد هزار");
    expect(numberToPersianWords(1234567)).toBe("یک میلیون و دویست و سی و چهار هزار و پانصد و شصت و هفت");
    expect(numberToPersianWords(3000000000)).toBe("سه میلیارد");
  });
  it("adds currency", () => {
    expect(tomanInWords(12500000)).toBe("دوازده میلیون و پانصد هزار تومان");
    expect(tomanInWords(0)).toBe("");
  });
});

describe("jalali", () => {
  it("round trips", () => {
    const iso = jalaliToISO(1405, 8, 1);
    expect(toJalali(iso)).toEqual({ y: 1405, m: 8, d: 1 });
    expect(formatJalaliShort(iso)).toBe("۱۴۰۵/۰۸/۰۱");
  });
  it("formats long date with weekday", () => {
    expect(formatJalaliLong(jalaliToISO(1405, 8, 1))).toMatch(/^\S+ ۱ آبان ۱۴۰۵$/);
  });
  it("knows month lengths and leap years", () => {
    expect(jalaliMonthLength(1405, 1)).toBe(31);
    expect(jalaliMonthLength(1405, 7)).toBe(30);
    expect(jalaliMonthLength(1405, 12)).toBe(29);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(isJalaliLeap(1403)).toBe(true);
    expect(isJalaliLeap(1405)).toBe(false);
  });
  it("clamps month-end additions from the original day and matches the library", () => {
    const start = jalaliToISO(1405, 6, 31);
    for (let n = 0; n < 24; n++) expect(addJalaliMonthsISO(start, n)).toBe(addJalaliMonthsLib(start, n));
    expect(toJalali(addJalaliMonthsISO(start, 1))).toEqual({ y: 1405, m: 7, d: 30 });
    expect(toJalali(addJalaliMonthsISO(start, 7))).toEqual({ y: 1406, m: 1, d: 31 });
  });
  it("relative labels", () => {
    const t = jalaliToISO(1405, 8, 10);
    expect(relativeLabel(t, t)).toBe("امروز");
    expect(relativeLabel(jalaliToISO(1405, 8, 11), t)).toBe("فردا");
    expect(relativeLabel(jalaliToISO(1405, 8, 13), t)).toBe("۳ روز دیگر");
    expect(relativeLabel(jalaliToISO(1405, 8, 5), t)).toBe("۵ روز گذشته");
  });
  it("builds Saturday-first month grids", () => {
    const g = monthGrid(1405, 1);
    expect(g.length % 7).toBe(0);
    expect(g.filter((c) => c.inMonth).length).toBe(31);
    expect(g.find((c) => c.inMonth)!.jd.d).toBe(1);
  });
  it("shifts months across years", () => {
    expect(shiftMonth(1405, 12, 1)).toEqual({ y: 1406, m: 1 });
    expect(shiftMonth(1405, 1, -1)).toEqual({ y: 1404, m: 12 });
  });
});

describe("schedule", () => {
  const base = { downPayment: 0, profitRate: 0, intervalType: "monthly" as const, intervalValue: 1 };

  it("month-end clamping for a 12-month plan starting 1405/06/31", () => {
    const start = jalaliToISO(1405, 6, 31);
    const days = dueDates(start, 12, "monthly", 1).map(toJalali);
    expect(days[0]).toEqual({ y: 1405, m: 6, d: 31 });
    for (let k = 1; k <= 5; k++) expect(days[k]).toEqual({ y: 1405, m: 6 + k, d: 30 }); // months 7-11
    expect(days[6]).toEqual({ y: 1405, m: 12, d: 29 }); // Esfand (non-leap)
    expect(days[7]).toEqual({ y: 1406, m: 1, d: 31 }); // back to 31
    expect(days[11]).toEqual({ y: 1406, m: 5, d: 31 });
  });

  it("uses 30 for Esfand in a leap year", () => {
    const start = jalaliToISO(1403, 11, 30);
    const days = dueDates(start, 2, "monthly", 1).map(toJalali);
    expect(days[1]).toEqual({ y: 1403, m: 12, d: 30 });
  });

  it("splits evenly with zero profit", () => {
    const r = generateSchedule({ ...base, totalAmount: 12_000_000, count: 12, startDate: jalaliToISO(1405, 1, 1) });
    expect(r.installmentAmount).toBe(1_000_000);
    expect(r.items.every((x) => x.amount === 1_000_000)).toBe(true);
    expect(r.totalPayable).toBe(12_000_000);
    expect(r.totalProfit).toBe(0);
  });

  it("puts the rounding remainder on the last installment and sums exactly", () => {
    const r = generateSchedule({ ...base, totalAmount: 10_000_000, count: 3, startDate: jalaliToISO(1405, 1, 1) });
    expect(r.items.map((x) => x.amount)).toEqual([3_333_000, 3_333_000, 3_334_000]);
    expect(r.installmentsTotal).toBe(10_000_000);
  });

  it("subtracts the down payment and keeps the total exact", () => {
    const r = generateSchedule({ ...base, totalAmount: 50_000_000, downPayment: 10_000_000, count: 7, startDate: jalaliToISO(1405, 1, 1) });
    expect(r.financed).toBe(40_000_000);
    expect(r.installmentsTotal).toBe(40_000_000);
    expect(r.totalPayable).toBe(50_000_000);
  });

  it("applies amortized profit formula", () => {
    const r = generateSchedule({ ...base, totalAmount: 100_000_000, profitRate: 23, count: 12, startDate: jalaliToISO(1405, 1, 1) });
    // A = P*i*(1+i)^n/((1+i)^n-1), i = 23/1200
    const i = 23 / 1200;
    const exact = (100_000_000 * i * Math.pow(1 + i, 12)) / (Math.pow(1 + i, 12) - 1);
    expect(r.installmentAmount).toBe(Math.round(exact / 1000) * 1000);
    expect(r.installmentAmount % 1000).toBe(0);
    expect(r.installmentsTotal).toBe(Math.round(exact * 12));
    expect(r.totalProfit).toBe(r.totalPayable - 100_000_000);
    expect(r.totalProfit).toBeGreaterThan(0);
  });

  it("supports weekly and day intervals", () => {
    const start = jalaliToISO(1405, 1, 1);
    const w = dueDates(start, 3, "weekly", 2);
    expect(w.map((d) => toJalali(d).d)).toEqual([1, 15, 29]);
    const d = dueDates(start, 3, "days", 10);
    expect(d.map((x) => toJalali(x).d)).toEqual([1, 11, 21]);
  });

  it("honours an override amount", () => {
    const r = generateSchedule({ ...base, totalAmount: 10_000_000, count: 4, startDate: jalaliToISO(1405, 1, 1), overrideAmount: 2_700_000 });
    expect(r.items.every((x) => x.amount === 2_700_000)).toBe(true);
    expect(r.totalPayable).toBe(10_800_000);
    expect(r.totalProfit).toBe(800_000);
  });
});

describe("status", () => {
  const today = jalaliToISO(1405, 8, 10);
  const mk = (due: string, amount = 100, paid = 0) => ({ due_date: due, amount, paid_amount: paid });
  it("derives statuses", () => {
    expect(statusOf(mk(today, 100, 100), today)).toBe("paid");
    expect(statusOf(mk(today, 100, 150), today)).toBe("paid");
    expect(statusOf(mk(today, 100, 40), today)).toBe("partial");
    expect(statusOf(mk(jalaliToISO(1405, 8, 9)), today)).toBe("overdue");
    expect(statusOf(mk(today), today)).toBe("due-soon");
    expect(statusOf(mk(jalaliToISO(1405, 8, 13)), today, 3)).toBe("due-soon");
    expect(statusOf(mk(jalaliToISO(1405, 8, 14)), today, 3)).toBe("upcoming");
  });
  it("overdue helper includes partially paid", () => {
    expect(isOverdue(mk(jalaliToISO(1405, 8, 1), 100, 40), today)).toBe(true);
    expect(isOverdue(mk(jalaliToISO(1405, 8, 1), 100, 100), today)).toBe(false);
    expect(isOverdue(mk(today), today)).toBe(false);
  });
});
