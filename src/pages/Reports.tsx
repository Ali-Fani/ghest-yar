import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { BarChart3, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { YTick } from "../components/ChartBits";
import { useDerived } from "../lib/useDerived";
import type { DueItem } from "../lib/dueItems";
import { JALALI_MONTHS, currentJalaliYear, formatJalaliShort, toJalali } from "../lib/jalali";
import { formatToman, formatTomanCompact } from "../lib/money";
import { toFaDigits } from "../lib/digits";
import { STATUS_LABEL } from "../lib/status";
import { buildCsv, saveTextFile } from "../lib/backup";
import { DIRECTION_LABEL, PLAN_KIND_LABEL } from "../lib/constants";
import { Card, SectionTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState, PageHeader, Segmented } from "../components/ui/Misc";
import { cn } from "../lib/utils";

type Dir = "all" | "payable" | "receivable";

export function Reports() {
  const { dueItems } = useDerived();
  const [year, setYear] = useState(currentJalaliYear());
  const [dir, setDir] = useState<Dir>("payable");

  const data = useMemo(() => {
    const rows = dueItems.filter((i) => {
      if (dir !== "all" && i.direction !== dir) return false;
      return toJalali(i.dueDate).y === year;
    });
    const months = Array.from({ length: 12 }, (_, k) => {
      const items = rows.filter((i) => toJalali(i.dueDate).m === k + 1);
      return {
        name: JALALI_MONTHS[k],
        count: items.length,
        due: items.reduce((s, i) => s + i.amount, 0),
        paid: items.reduce((s, i) => s + Math.min(i.paidAmount, i.amount), 0),
        left: items.reduce((s, i) => s + i.remaining, 0),
      };
    });
    const group = (keyOf: (i: DueItem) => { key: string; color: string }) => {
      const m = new Map<string, { name: string; color: string; count: number; due: number; paid: number; left: number }>();
      for (const i of rows) {
        const k = keyOf(i);
        const g = m.get(k.key) ?? { name: k.key, color: k.color, count: 0, due: 0, paid: 0, left: 0 };
        g.count += 1;
        g.due += i.amount;
        g.paid += Math.min(i.paidAmount, i.amount);
        g.left += i.remaining;
        m.set(k.key, g);
      }
      return [...m.values()].sort((a, b) => b.due - a.due);
    };
    const byProvider = group((i) => ({ key: i.providerName ?? "بدون ارائه‌دهنده", color: i.providerName ? i.color : "var(--muted)" }));
    const byType = group((i) => ({
      key: i.kind === "statement" ? "صورتحساب" : i.planKind ? PLAN_KIND_LABEL[i.planKind] : "وام",
      color: i.kind === "statement" ? "var(--warn)" : i.planKind === "loan" ? "var(--accent)" : i.planKind === "personal" ? "var(--info)" : "#a855f7",
    }));
    return {
      rows,
      byProvider,
      byType,
      months,
      due: months.reduce((s, m) => s + m.due, 0),
      paid: months.reduce((s, m) => s + m.paid, 0),
      left: months.reduce((s, m) => s + m.left, 0),
      done: rows.filter((i) => i.paid).length,
    };
  }, [dueItems, year, dir]);

  const exportCsv = async () => {
    const head = ["عنوان", "نوع", "نوع قسط", "ارائه‌دهنده", "طرف حساب", "دسته", "شماره قسط", "تاریخ سررسید", "مبلغ (تومان)", "پرداخت‌شده (تومان)", "وضعیت"];
    const kindLabel = (i: DueItem) => (i.kind === "statement" ? "صورتحساب" : i.planKind ? PLAN_KIND_LABEL[i.planKind] : "");
    const body = data.rows.map((i) => [
      i.title, DIRECTION_LABEL[i.direction], kindLabel(i), i.providerName ?? "", i.counterparty ?? "",
      i.category ?? "", i.kind === "installment" ? toFaDigits(i.seq ?? 0) : "", formatJalaliShort(i.dueDate), i.amount, i.paidAmount,
      i.open ? "صورتحساب جاری" : STATUS_LABEL[i.status],
    ]);
    const ok = await saveTextFile(`ghestyar-report-${year}.csv`, buildCsv([head, ...body]), "csv", "فایل CSV");
    if (ok) toast.success("گزارش ذخیره شد");
  };

  const pct = data.due ? Math.round((data.paid / data.due) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="گزارش‌ها"
        subtitle="خلاصه سالانه پرداخت‌ها بر اساس سال شمسی"
        actions={
          <>
            <Segmented
              value={dir}
              onChange={setDir}
              options={[
                { value: "payable", label: "بدهی من" },
                { value: "receivable", label: "طلب من" },
                { value: "all", label: "همه" },
              ]}
            />
            <Button variant="secondary" size="icon" onClick={() => setYear((y) => y - 1)} aria-label="سال قبل">
              <ChevronRight size={18} />
            </Button>
            <div className="w-16 text-center text-[17px] font-extrabold num">{toFaDigits(year)}</div>
            <Button variant="secondary" size="icon" onClick={() => setYear((y) => y + 1)} aria-label="سال بعد">
              <ChevronLeft size={18} />
            </Button>
            <Button variant="primary" onClick={() => void exportCsv()} disabled={data.rows.length === 0}>
              <Download size={17} /> خروجی CSV
            </Button>
          </>
        }
      />

      {data.rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface/60">
          <EmptyState icon={<BarChart3 size={38} />} title={`در سال ${toFaDigits(year)} قسطی وجود ندارد`} description="سال دیگری را انتخاب کنید یا قسط جدیدی ثبت کنید." />
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-4 gap-4">
            <Summary label="مجموع سررسیدها" value={formatToman(data.due)} sub={`${toFaDigits(data.rows.length)} قسط`} />
            <Summary label="پرداخت‌شده" value={formatToman(data.paid)} sub={`${toFaDigits(data.done)} قسط · ${toFaDigits(pct)}٪`} tone="accent" />
            <Summary label="باقی‌مانده" value={formatToman(data.left)} tone={data.left > 0 ? "warn" : undefined} />
            <Summary label="درصد پیشرفت" value={`${toFaDigits(pct)}٪`} progress={pct} />
          </div>

          <Card className="mb-5 p-5">
            <SectionTitle>پرداخت‌شده در برابر باقی‌مانده (ماهانه)</SectionTitle>
            <div className="h-[260px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.months} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
                  <XAxis dataKey="name" reversed tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} tick={{ fill: "var(--muted)", fontSize: 10.5, fontFamily: "inherit" }} />
                  <YAxis orientation="right" tickLine={false} axisLine={false} width={84} tick={<YTick />} />
                  <Tooltip
                    cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const r = payload[0].payload as (typeof data.months)[number];
                      return (
                        <div dir="rtl" className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] shadow-pop">
                          <div className="mb-1 font-bold">{r.name}</div>
                          <div className="text-accent-ink">پرداخت‌شده: <span className="num">{formatToman(r.paid)}</span></div>
                          <div className="text-warn-ink">باقی‌مانده: <span className="num">{formatToman(r.left)}</span></div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="paid" stackId="a" fill="var(--accent)" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="left" stackId="a" fill="var(--warn)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="mb-5 grid grid-cols-2 gap-5">
            <BreakdownCard title="بر اساس ارائه‌دهنده" rows={data.byProvider} />
            <BreakdownCard title="بر اساس نوع" rows={data.byType} />
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-[13.5px]">
              <thead className="bg-surface-2/60 text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 text-start font-medium">ماه</th>
                  <th className="px-3 py-3 text-start font-medium">تعداد اقساط</th>
                  <th className="px-3 py-3 text-start font-medium">مجموع سررسید</th>
                  <th className="px-3 py-3 text-start font-medium">پرداخت‌شده</th>
                  <th className="px-3 py-3 text-start font-medium">باقی‌مانده</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m, i) => (
                  <motion.tr key={m.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className={cn("border-t border-line", m.count === 0 && "text-muted/60")}>
                    <td className="px-5 py-2.5 font-medium">{m.name}</td>
                    <td className="px-3 py-2.5 num">{toFaDigits(m.count)}</td>
                    <td className="px-3 py-2.5 num">{m.count ? formatToman(m.due) : "—"}</td>
                    <td className="px-3 py-2.5 text-accent-ink num">{m.count ? formatToman(m.paid) : "—"}</td>
                    <td className={cn("px-3 py-2.5 num", m.left > 0 && "font-semibold text-warn-ink")}>{m.count ? formatToman(m.left) : "—"}</td>
                  </motion.tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line bg-surface-2/40 font-bold">
                <tr>
                  <td className="px-5 py-3">جمع سال</td>
                  <td className="px-3 py-3 num">{toFaDigits(data.rows.length)}</td>
                  <td className="px-3 py-3 num">{formatToman(data.due)}</td>
                  <td className="px-3 py-3 text-accent-ink num">{formatToman(data.paid)}</td>
                  <td className="px-3 py-3 text-warn-ink num">{formatToman(data.left)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Summary({ label, value, sub, tone, progress }: { label: string; value: string; sub?: string; tone?: "accent" | "warn"; progress?: number }) {
  return (
    <Card hover className="p-5">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cn("mt-1.5 text-[19px] font-extrabold num", tone === "accent" && "text-accent-ink", tone === "warn" && "text-warn-ink")}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.9 }} />
        </div>
      )}
    </Card>
  );
}

type BreakdownRow = { name: string; color: string; count: number; due: number; paid: number; left: number };

function BreakdownCard({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.due));
  return (
    <Card className="p-5">
      <SectionTitle>{title}</SectionTitle>
      <div className="flex flex-col gap-3.5">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="mb-1.5 flex items-center justify-between gap-3 whitespace-nowrap text-[13px]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="truncate font-medium">{r.name}</span>
                <span className="shrink-0 text-xs text-muted num">{toFaDigits(r.count)} مورد</span>
              </span>
              <span className="shrink-0 font-bold num">{formatTomanCompact(r.due)} تومان</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="flex h-full" style={{ width: `${(r.due / max) * 100}%` }}>
                <div className="h-full bg-accent" style={{ width: `${r.due ? (r.paid / r.due) * 100 : 0}%` }} />
                <div className="h-full flex-1 bg-warn" />
              </div>
            </div>
            <div className="mt-1 flex justify-between whitespace-nowrap text-[11.5px] text-muted num">
              <span>پرداخت‌شده {formatTomanCompact(r.paid)}</span>
              <span>باقی‌مانده {formatTomanCompact(r.left)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
