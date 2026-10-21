import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { AlertTriangle, ArrowLeft, Check, CalendarClock, HandCoins, PartyPopper, PiggyBank, Plus, Sparkles, TrendingDown, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { YTick } from "../components/ChartBits";
import { usePlans } from "../store/usePlans";
import { useSettings } from "../store/useSettings";
import { useUI } from "../store/useUI";
import { JALALI_MONTHS, diffDays, formatJalaliLong, monthKey, shiftMonth, todayISO, toJalali } from "../lib/jalali";
import { formatToman, formatTomanCompact } from "../lib/money";
import { toFaDigits } from "../lib/digits";
import { isOverdue, isPaid, remaining } from "../lib/status";
import { quickPay } from "../lib/actions";
import { Card, SectionTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState, PageHeader } from "../components/ui/Misc";
import { InstallmentRow } from "../components/InstallmentRow";
import { PlanIcon } from "../components/ui/PlanIcon";
import { seedDemo } from "../lib/seed";
import { cn } from "../lib/utils";

const DONUT_COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#a855f7", "#f43f5e", "#14b8a6", "#6366f1", "#84cc16"];

export function Dashboard() {
  const { plans, installments } = usePlans();
  const openWizard = useUI((s) => s.openWizard);
  const reminderDays = useSettings((s) => s.reminderDays);
  const today = todayISO();

  const d = useMemo(() => {
    const planById = new Map(plans.map((p) => [p.id, p]));
    const live = installments.filter((i) => {
      const p = planById.get(i.plan_id);
      return p && !p.archived;
    });
    const pay = live.filter((i) => planById.get(i.plan_id)!.direction === "payable");
    const rec = live.filter((i) => planById.get(i.plan_id)!.direction === "receivable");
    const cur = monthKey(today);
    const sum = (a: typeof pay, f: (i: (typeof pay)[number]) => number) => a.reduce((s, i) => s + f(i), 0);

    const thisMonth = pay.filter((i) => monthKey(i.due_date) === cur);
    const overdue = pay.filter((i) => isOverdue(i, today)).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const upcoming = pay.filter((i) => !isPaid(i) && i.due_date >= today && diffDays(i.due_date, today) <= 30).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const nextUnpaid = pay.filter((i) => !isPaid(i)).sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null;

    // Next 12 Jalali months
    const j = toJalali(today);
    const months = Array.from({ length: 12 }, (_, k) => {
      const { y, m } = shiftMonth(j.y, j.m, k);
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const items = pay.filter((i) => monthKey(i.due_date) === key);
      return {
        name: JALALI_MONTHS[m - 1],
        label: `${JALALI_MONTHS[m - 1]} ${toFaDigits(y)}`,
        paid: sum(items, (i) => Math.min(i.paid_amount, i.amount)),
        unpaid: sum(items, remaining),
      };
    });

    const byCat = new Map<string, number>();
    for (const i of pay) {
      const c = planById.get(i.plan_id)!.category || "بدون دسته";
      byCat.set(c, (byCat.get(c) ?? 0) + remaining(i));
    }
    const cats = [...byCat.entries()].filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return {
      planById,
      debt: sum(pay, remaining),
      monthDue: sum(thisMonth, (i) => i.amount),
      monthPaid: sum(thisMonth, (i) => Math.min(i.paid_amount, i.amount)),
      overdue,
      overdueSum: sum(overdue, remaining),
      upcoming,
      nextUnpaid,
      months,
      cats,
      catTotal: cats.reduce((s, c) => s + c.value, 0),
      recRemaining: sum(rec, remaining),
      hasRec: rec.length > 0,
    };
  }, [plans, installments, today]);

  if (plans.length === 0) {
    return (
      <div>
        <PageHeader title="داشبورد" subtitle="خلاصه وضعیت اقساط شما" />
        <div className="rounded-3xl border border-dashed border-line bg-surface/60">
          <EmptyState
            icon={<PiggyBank size={40} />}
            title="به قسط‌یار خوش آمدید"
            description="اقساط خود را ثبت کنید تا قسط بعدی، معوقات و برنامه پرداخت ماه‌های آینده را در یک نگاه ببینید."
            action={{ label: "ثبت اولین قسط", onClick: () => openWizard() }}
          />
          {import.meta.env.DEV && (
            <div className="pb-8 text-center">
              <Button variant="ghost" onClick={() => void seedDemo()}>
                <Sparkles size={16} /> بارگذاری داده نمایشی (فقط توسعه)
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const n = d.nextUnpaid;
  const nPlan = n ? d.planById.get(n.plan_id)! : null;
  const nDays = n ? diffDays(n.due_date, today) : 0;
  const nOver = n ? n.due_date < today : false;
  const monthPct = d.monthDue ? Math.round((d.monthPaid / d.monthDue) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="داشبورد"
        subtitle={formatJalaliLong(today)}
        actions={
          <Button variant="primary" onClick={() => openWizard()}>
            <Plus size={18} /> قسط جدید
          </Button>
        }
      />

      {/* KPIs */}
      <div className={cn("mb-5 grid gap-4", d.hasRec ? "grid-cols-4" : "grid-cols-3")}>
        <Kpi i={0} icon={<TrendingDown size={20} />} tone="accent" label="مجموع بدهی باقی‌مانده" value={formatToman(d.debt)} sub={`${formatTomanCompact(d.debt)} تومان`} />
        <Kpi
          i={1}
          icon={<CalendarClock size={20} />}
          tone="info"
          label="پرداختی این ماه"
          value={`${formatTomanCompact(d.monthPaid)} از ${formatTomanCompact(d.monthDue)}`}
          sub={`${toFaDigits(monthPct)}٪ پرداخت شده`}
          progress={monthPct}
        />
        <Kpi
          i={2}
          icon={<AlertTriangle size={20} />}
          tone={d.overdue.length ? "danger" : "accent"}
          label="اقساط معوق"
          value={d.overdue.length ? `${toFaDigits(d.overdue.length)} قسط` : "بدون معوقه"}
          sub={d.overdue.length ? formatToman(d.overdueSum) : "همه چیز به‌روز است"}
        />
        {d.hasRec && <Kpi i={3} icon={<HandCoins size={20} />} tone="sky" label="طلب باقی‌مانده" value={formatToman(d.recRemaining)} sub={`${formatTomanCompact(d.recRemaining)} تومان`} />}
      </div>

      {/* Hero + chart */}
      <div className="mb-5 grid grid-cols-[minmax(320px,380px)_1fr] gap-5">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="relative h-full overflow-hidden p-6">
            <div
              className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full opacity-30 blur-3xl"
              style={{ background: nOver ? "var(--danger)" : "var(--accent)" }}
            />
            <div className="relative flex h-full flex-col">
              <div className="text-[13px] font-medium text-muted">قسط بعدی</div>
              {n && nPlan ? (
                <>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className={cn("text-[64px] font-black leading-none tracking-tight num", nOver ? "text-danger" : "text-accent-strong")}>
                      {nDays === 0 ? "امروز" : toFaDigits(Math.abs(nDays))}
                    </span>
                    {nDays !== 0 && <span className="text-lg font-bold text-muted">{nOver ? "روز گذشته" : "روز دیگر"}</span>}
                  </div>
                  <div className="mt-1 text-[13px] text-muted num">{formatJalaliLong(n.due_date)}</div>
                  <Link to={`/plans/${nPlan.id}`} className="mt-5 flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3 transition-colors hover:bg-surface-2">
                    <PlanIcon icon={nPlan.icon} color={nPlan.color} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{nPlan.title}</div>
                      <div className="text-xs text-muted num">قسط {toFaDigits(n.seq)} از {toFaDigits(nPlan.installment_count)}</div>
                    </div>
                    <ArrowLeft size={16} className="text-muted" />
                  </Link>
                  <div className="mt-auto pt-5">
                    <div className="mb-3 text-[22px] font-extrabold num">{formatToman(remaining(n))}</div>
                    <Button variant="primary" size="lg" className="w-full" onClick={() => void quickPay(n.id)}>
                      <Check size={19} strokeWidth={2.8} /> پرداخت شد
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <div className="flex size-16 items-center justify-center rounded-3xl bg-accent-soft text-accent-ink">
                    <PartyPopper size={30} />
                  </div>
                  <div className="font-bold">قسط پرداخت‌نشده‌ای ندارید</div>
                  <div className="text-[13px] text-muted">همه اقساط شما تسویه شده است.</div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Card className="h-full p-5">
            <SectionTitle
              action={
                <div className="flex items-center gap-3 text-xs text-muted">
                  <Legend color="var(--accent)" label="پرداخت‌شده" />
                  <Legend color="var(--warn)" label="باقی‌مانده" />
                </div>
              }
            >
              سررسیدها در ۱۲ ماه آینده
            </SectionTitle>
            <div className="h-[280px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.months} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
                  <XAxis dataKey="name" reversed tickLine={false} axisLine={false} interval={0} tick={{ fill: "var(--muted)", fontSize: 10.5, fontFamily: "inherit" }} />
                  <YAxis orientation="right" tickLine={false} axisLine={false} width={84} tick={<YTick />} />
                  <Tooltip
                    cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as (typeof d.months)[number];
                      return (
                        <div dir="rtl" className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] shadow-pop">
                          <div className="mb-1 font-bold">{row.label}</div>
                          <div className="text-accent-ink">پرداخت‌شده: <span className="num">{formatToman(row.paid)}</span></div>
                          <div className="text-warn-ink">باقی‌مانده: <span className="num">{formatToman(row.unpaid)}</span></div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="paid" stackId="a" fill="var(--accent)" radius={[0, 0, 4, 4]} animationDuration={900} />
                  <Bar dataKey="unpaid" stackId="a" fill="var(--warn)" radius={[6, 6, 0, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5">
          <SectionTitle>۳۰ روز آینده</SectionTitle>
          {d.upcoming.length === 0 ? (
            <Placeholder text="سررسیدی در ۳۰ روز آینده نیست" />
          ) : (
            <div className="-mx-2 flex max-h-[340px] flex-col overflow-y-auto">
              {d.upcoming.map((i) => (
                <InstallmentRow key={i.id} inst={i} plan={d.planById.get(i.plan_id)!} today={today} />
              ))}
            </div>
          )}
        </Card>
        <Card className={cn("p-5", d.overdue.length > 0 && "ring-1 ring-danger/30")}>
          <SectionTitle>
            <span className={cn("flex items-center gap-2", d.overdue.length > 0 && "text-danger-ink")}>
              {d.overdue.length > 0 && <AlertTriangle size={16} />} معوقات
            </span>
          </SectionTitle>
          {d.overdue.length === 0 ? (
            <Placeholder text="هیچ قسط معوقی ندارید. آفرین!" good />
          ) : (
            <div className="-mx-2 flex max-h-[340px] flex-col overflow-y-auto">
              {d.overdue.map((i) => (
                <InstallmentRow key={i.id} inst={i} plan={d.planById.get(i.plan_id)!} today={today} />
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle>باقی‌مانده بر اساس دسته</SectionTitle>
          {d.cats.length === 0 ? (
            <Placeholder text="بدهی باقی‌مانده‌ای وجود ندارد" good />
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative size-[170px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={d.cats} dataKey="value" nameKey="name" innerRadius={54} outerRadius={80} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={900}>
                      {d.cats.map((c, i) => (
                        <Cell key={c.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-[11px] text-muted">مجموع</div>
                  <div className="text-[13px] font-extrabold num">{formatTomanCompact(d.catTotal)}</div>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {d.cats.slice(0, 6).map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2 text-[12.5px]">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="font-semibold text-muted num">{toFaDigits(Math.round((c.value / d.catTotal) * 100))}٪</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Placeholder({ text, good }: { text: string; good?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-[13px] text-muted">
      <div className={cn("flex size-12 items-center justify-center rounded-2xl", good ? "bg-accent-soft text-accent-ink" : "bg-surface-2")}>
        {good ? <Check size={22} /> : <WalletCards size={22} />}
      </div>
      {text}
    </div>
  );
}

const toneMap = {
  accent: "bg-accent-soft text-accent-ink",
  info: "bg-info-soft text-info-ink",
  danger: "bg-danger-soft text-danger-ink",
  sky: "bg-info-soft text-info-ink",
} as const;

function Kpi({ icon, label, value, sub, tone, i, progress }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: keyof typeof toneMap; i: number; progress?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <Card hover className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-muted">{label}</span>
          <span className={cn("flex size-9 items-center justify-center rounded-xl", toneMap[tone])}>{icon}</span>
        </div>
        <div className={cn("mt-3 text-[20px] font-extrabold leading-tight num", tone === "danger" && "text-danger-ink")}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted num">{sub}</div>}
        {progress !== undefined && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <motion.div className="h-full rounded-full bg-info" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.9, ease: "easeOut" }} />
          </div>
        )}
      </Card>
    </motion.div>
  );
}
