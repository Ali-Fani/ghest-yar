import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { usePlans } from "../store/usePlans";
import { WEEK_HEADERS, formatJalaliLong, formatMonthYear, monthGrid, shiftMonth, toJalali, todayISO } from "../lib/jalali";
import { toFaDigits } from "../lib/digits";
import { isPaid } from "../lib/status";
import { formatToman } from "../lib/money";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { InstallmentRow } from "../components/InstallmentRow";
import { PageHeader } from "../components/ui/Misc";
import { cn } from "../lib/utils";

export function CalendarPage() {
  const { plans, installments } = usePlans();
  const today = todayISO();
  const tj = toJalali(today);
  const [view, setView] = useState({ y: tj.y, m: tj.m });
  const [selected, setSelected] = useState<string>(today);
  const [dirn, setDirn] = useState(1);

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const byDate = useMemo(() => {
    const m = new Map<string, typeof installments>();
    for (const i of installments) {
      const p = planById.get(i.plan_id);
      if (!p || p.archived) continue;
      const arr = m.get(i.due_date) ?? [];
      arr.push(i);
      m.set(i.due_date, arr);
    }
    return m;
  }, [installments, planById]);

  const cells = monthGrid(view.y, view.m);
  const go = (d: number) => {
    setDirn(d);
    setView((v) => shiftMonth(v.y, v.m, d));
  };
  const goToday = () => {
    setView({ y: tj.y, m: tj.m });
    setSelected(today);
  };

  const dayItems = byDate.get(selected) ?? [];
  const monthTotal = cells.filter((c) => c.inMonth).reduce((s, c) => s + (byDate.get(c.iso) ?? []).filter((i) => !isPaid(i)).reduce((a, i) => a + (i.amount - i.paid_amount), 0), 0);

  return (
    <div>
      <PageHeader
        title="تقویم"
        subtitle="سررسید اقساط در تقویم شمسی"
        actions={
          <>
            <div className="ms-2 text-[13px] text-muted">
              مانده این ماه: <span className="font-bold text-fg num">{formatToman(monthTotal)}</span>
            </div>
            <Button variant="secondary" size="icon" onClick={() => go(-1)} aria-label="ماه قبل">
              <ChevronRight size={18} />
            </Button>
            <div className="w-36 text-center text-[15px] font-bold">{formatMonthYear(view.y, view.m)}</div>
            <Button variant="secondary" size="icon" onClick={() => go(1)} aria-label="ماه بعد">
              <ChevronLeft size={18} />
            </Button>
            <Button variant="soft" onClick={goToday}>
              امروز
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[1fr_380px] items-start gap-5">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2/50">
            {WEEK_HEADERS.map((w, i) => (
              <div key={w} className={cn("py-2.5 text-center text-xs font-semibold", i === 6 ? "text-danger-ink" : "text-muted")}>
                {w}
              </div>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${view.y}-${view.m}`}
              initial={{ opacity: 0, x: -18 * dirn }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 18 * dirn }}
              transition={{ duration: 0.16 }}
              className="grid grid-cols-7"
            >
              {cells.map((c, idx) => {
                const items = byDate.get(c.iso) ?? [];
                const friday = idx % 7 === 6;
                const isToday = c.iso === today;
                const isSel = c.iso === selected;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    onClick={() => setSelected(c.iso)}
                    className={cn(
                      "relative flex min-h-[96px] cursor-pointer flex-col gap-1 border-b border-s border-line p-1.5 text-start transition-colors hover:bg-surface-2/70",
                      friday && "bg-danger-soft/25",
                      !c.inMonth && "opacity-40",
                      isSel && "bg-accent-soft/60 outline outline-2 -outline-offset-2 outline-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-[13px] font-semibold num",
                        friday && !isToday && "text-danger-ink",
                        isToday && "bg-accent-strong text-white",
                      )}
                    >
                      {toFaDigits(c.jd.d)}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {items.slice(0, 2).map((i) => {
                        const p = planById.get(i.plan_id)!;
                        const paid = isPaid(i);
                        const overdue = !paid && i.due_date < today;
                        return (
                          <span
                            key={i.id}
                            className={cn("truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4", paid && "line-through opacity-60", overdue && "ring-1 ring-danger")}
                            style={{ background: `color-mix(in srgb, ${p.color} 18%, transparent)`, color: p.color }}
                          >
                            {p.title}
                          </span>
                        );
                      })}
                      {items.length > 2 && <span className="px-1 text-[11px] text-muted num">+{toFaDigits(items.length - 2)} مورد دیگر</span>}
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </Card>

        <Card className="sticky top-0 p-5">
          <div className="mb-1 flex items-center gap-2 text-[13px] text-muted">
            <CalendarDays size={15} /> روز انتخاب‌شده
          </div>
          <div className="mb-4 text-[16px] font-extrabold num">{formatJalaliLong(selected)}</div>
          {dayItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line py-10 text-center text-[13px] text-muted">در این روز سررسیدی نیست</div>
          ) : (
            <div className="-mx-2 flex flex-col">
              {dayItems.map((i) => (
                <InstallmentRow key={i.id} inst={i} plan={planById.get(i.plan_id)!} today={today} showDate={false} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
