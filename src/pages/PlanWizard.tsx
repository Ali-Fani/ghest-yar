import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useUI } from "../store/useUI";
import { usePlans } from "../store/usePlans";
import { Modal, ConfirmDialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Field, Input, NumInput, Textarea } from "../components/ui/Input";
import { MoneyInput } from "../components/ui/MoneyInput";
import { Select } from "../components/ui/Select";
import { Segmented, Switch } from "../components/ui/Misc";
import { JalaliDatePicker } from "../components/ui/JalaliDatePicker";
import { ICON_MAP, PlanIcon } from "../components/ui/PlanIcon";
import { CATEGORIES, DIRECTION_LABEL, INTERVAL_LABEL, PLAN_COLORS, PLAN_ICONS } from "../lib/constants";
import { generateSchedule, type IntervalType } from "../lib/schedule";
import { formatJalaliLong, formatJalaliShort, jalaliToISO, relativeLabel, toJalali, todayISO, addJalaliMonthsISO } from "../lib/jalali";
import { formatToman } from "../lib/money";
import { parseDecimalInput, parseIntInput, toFaDigits } from "../lib/digits";
import type { Direction, NewPlan } from "../lib/types";
import { cn } from "../lib/utils";

interface Form {
  title: string;
  direction: Direction;
  counterparty: string;
  category: string;
  icon: string;
  color: string;
  total: number;
  down: number;
  rate: string;
  count: string;
  intervalType: IntervalType;
  intervalValue: string;
  start: string;
  overrideOn: boolean;
  overrideAmount: number;
  notes: string;
}

function defaultStart(): string {
  const j = toJalali(todayISO());
  return addJalaliMonthsISO(jalaliToISO(j.y, j.m, 1), 1);
}

const emptyForm = (): Form => ({
  title: "", direction: "payable", counterparty: "", category: "خرید قسطی", icon: "wallet", color: PLAN_COLORS[0],
  total: 0, down: 0, rate: "0", count: "12", intervalType: "monthly", intervalValue: "1", start: defaultStart(),
  overrideOn: false, overrideAmount: 0, notes: "",
});

const STEPS = ["اطلاعات پایه", "مبلغ و زمان‌بندی", "پیش‌نمایش و ذخیره"];

export function PlanWizard() {
  const open = useUI((s) => s.wizardOpen);
  const editId = useUI((s) => s.wizardEditId);
  const close = useUI((s) => s.closeWizard);
  const { plans, installments, createPlan, savePlan } = usePlans();
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [dirn, setDirn] = useState(1);
  const [f, setF] = useState<Form>(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const editing = editId != null ? plans.find((p) => p.id === editId) : undefined;
  const kept = useMemo(() => (editing ? installments.filter((i) => i.plan_id === editing.id && i.paid_amount > 0) : []), [editing, installments]);
  const maxKeptSeq = Math.max(0, ...kept.map((i) => i.seq));

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setTouched(false);
    if (editing) {
      setF({
        title: editing.title, direction: editing.direction, counterparty: editing.counterparty ?? "", category: editing.category ?? "",
        icon: editing.icon, color: editing.color, total: editing.total_amount, down: editing.down_payment,
        rate: String(editing.profit_rate), count: String(editing.installment_count), intervalType: editing.interval_type,
        intervalValue: String(editing.interval_value), start: editing.start_date, overrideOn: false,
        overrideAmount: editing.installment_amount, notes: editing.notes ?? "",
      });
    } else setF(emptyForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const count = parseIntInput(f.count);
  const intervalValue = Math.max(1, parseIntInput(f.intervalValue));
  const rate = Number.isNaN(parseDecimalInput(f.rate)) ? 0 : parseDecimalInput(f.rate);

  const schedule = useMemo(() => {
    if (f.total <= 0 || count < 1 || count > 600) return null;
    return generateSchedule({
      totalAmount: f.total, downPayment: Math.min(f.down, f.total), profitRate: rate, count, intervalType: f.intervalType,
      intervalValue, startDate: f.start, overrideAmount: f.overrideOn && f.overrideAmount > 0 ? f.overrideAmount : null,
    });
  }, [f.total, f.down, rate, count, f.intervalType, intervalValue, f.start, f.overrideOn, f.overrideAmount]);

  // Keep the auto amount mirrored into the override field whenever the override is off.
  useEffect(() => {
    if (schedule && !f.overrideOn) setF((x) => (x.overrideAmount === schedule.installmentAmount ? x : { ...x, overrideAmount: schedule.installmentAmount }));
  }, [schedule, f.overrideOn]);

  const errors = {
    title: !f.title.trim() ? "عنوان را وارد کنید" : "",
    total: f.total <= 0 ? "مبلغ کل را وارد کنید" : "",
    down: f.down >= f.total && f.total > 0 ? "پیش‌پرداخت باید کمتر از مبلغ کل باشد" : "",
    count: count < 1 || count > 600 ? "تعداد اقساط معتبر نیست" : count < maxKeptSeq ? `حداقل ${toFaDigits(maxKeptSeq)} (اقساط پرداخت‌شده)` : "",
  };
  const stepValid = [!errors.title, !errors.total && !errors.down && !errors.count && !!f.start, !!schedule];

  const next = () => {
    if (!stepValid[step]) return setTouched(true);
    setTouched(false);
    setDirn(1);
    setStep((s) => Math.min(2, s + 1));
  };
  const back = () => {
    setDirn(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const planPayload = (): NewPlan => ({
    title: f.title.trim(), direction: f.direction, counterparty: f.counterparty.trim() || null, category: f.category || null,
    total_amount: f.total, down_payment: Math.min(f.down, f.total), profit_rate: rate, installment_count: count,
    installment_amount: schedule!.installmentAmount, start_date: f.start, interval_type: f.intervalType,
    interval_value: intervalValue, color: f.color, icon: f.icon, notes: f.notes.trim() || null,
    archived: editing?.archived ?? 0,
  });

  const doSave = async () => {
    if (!schedule) return;
    setBusy(true);
    try {
      if (editing) {
        const keptSeqs = new Set(kept.map((i) => i.seq));
        await savePlan(editing.id, planPayload(), schedule.items.filter((i) => !keptSeqs.has(i.seq)));
        toast.success("قسط ویرایش شد");
      } else {
        const id = await createPlan(planPayload(), schedule.items);
        toast.success("قسط جدید ایجاد شد");
        nav(`/plans/${id}`);
      }
      close();
    } catch (e) {
      console.error(e);
      toast.error("ذخیره‌سازی انجام نشد");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const onSave = () => {
    if (!schedule) return;
    if (editing && kept.length > 0) setConfirmOpen(true);
    else void doSave();
  };

  const err = (k: keyof typeof errors) => (touched ? errors[k] : "");

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => !o && close()}
        title={editing ? "ویرایش قسط" : "قسط جدید"}
        description={editing ? editing.title : "در سه مرحله برنامه اقساط را بسازید"}
        className="w-[min(1020px,96vw)]"
      >
        {/* Stepper */}
        <div className="flex items-center gap-2 border-b border-line bg-surface-2/50 px-6 py-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold num transition-colors",
                  i < step ? "bg-accent-strong text-white" : i === step ? "bg-accent-soft text-accent-ink ring-2 ring-accent" : "bg-surface text-muted ring-1 ring-line",
                )}
              >
                {i < step ? <Check size={14} strokeWidth={3} /> : toFaDigits(i + 1)}
              </div>
              <span className={cn("text-[13px] font-medium", i === step ? "text-fg" : "text-muted")}>{s}</span>
              {i < 2 && <div className={cn("h-px flex-1 transition-colors", i < step ? "bg-accent" : "bg-line")} />}
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="relative min-w-0 flex-1 overflow-y-auto px-6 py-5" style={{ maxHeight: "60vh", minHeight: 420 }}>
            <AnimatePresence mode="wait" custom={dirn} initial={false}>
              <motion.div
                key={step}
                custom={dirn}
                initial={{ opacity: 0, x: -24 * dirn }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 * dirn }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-5"
              >
                {step === 0 && (
                  <>
                    <Field label="عنوان" error={err("title")}>
                      <Input autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="مثلاً: وام خرید خودرو" />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="نوع">
                        <Segmented
                          className="w-full"
                          value={f.direction}
                          onChange={(v) => set("direction", v)}
                          options={[
                            { value: "payable", label: DIRECTION_LABEL.payable },
                            { value: "receivable", label: DIRECTION_LABEL.receivable },
                          ]}
                        />
                      </Field>
                      <Field label="دسته‌بندی">
                        <Select
                          value={f.category || "none"}
                          onValueChange={(v) => set("category", v === "none" ? "" : v)}
                          options={[{ value: "none", label: "بدون دسته" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
                        />
                      </Field>
                    </div>
                    <Field label={f.direction === "payable" ? "طرف حساب (بانک / فروشگاه / شخص)" : "بدهکار (نام شخص)"}>
                      <Input value={f.counterparty} onChange={(e) => set("counterparty", e.target.value)} placeholder="مثلاً: بانک ملی" />
                    </Field>
                    <Field label="آیکون">
                      <div className="flex flex-wrap gap-2">
                        {PLAN_ICONS.map((ic) => {
                          const I = ICON_MAP[ic];
                          const active = f.icon === ic;
                          return (
                            <button
                              key={ic}
                              type="button"
                              onClick={() => set("icon", ic)}
                              className={cn(
                                "flex size-11 cursor-pointer items-center justify-center rounded-xl border transition-all",
                                active ? "scale-105 border-transparent text-white shadow-soft" : "border-line bg-surface text-muted hover:text-fg",
                              )}
                              style={active ? { background: f.color } : undefined}
                              aria-label={ic}
                            >
                              <I size={20} />
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="رنگ">
                      <div className="flex flex-wrap gap-2.5">
                        {PLAN_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => set("color", c)}
                            aria-label={c}
                            className={cn("flex size-8 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110", f.color === c && "ring-2 ring-offset-2 ring-offset-surface")}
                            style={{ background: c, ["--tw-ring-color" as string]: c }}
                          >
                            {f.color === c && <Check size={15} className="text-white" strokeWidth={3} />}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="یادداشت (اختیاری)">
                      <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="شماره قرارداد، توضیحات…" />
                    </Field>
                  </>
                )}

                {step === 1 && (
                  <>
                    {kept.length > 0 && (
                      <div className="flex gap-2.5 rounded-xl bg-warn-soft px-4 py-3 text-[13px] leading-6 text-warn-ink">
                        <Info size={18} className="mt-0.5 shrink-0" />
                        <span>
                          {toFaDigits(kept.length)} قسط دارای پرداخت است و بدون تغییر می‌ماند؛ فقط اقساط پرداخت‌نشده دوباره ساخته می‌شوند.
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-5">
                      <Field label="مبلغ کل" error={err("total")}>
                        <MoneyInput value={f.total} onChange={(v) => set("total", v)} />
                      </Field>
                      <Field label="پیش‌پرداخت" error={err("down")}>
                        <MoneyInput value={f.down} onChange={(v) => set("down", v)} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <Field label="سود / کارمزد سالانه">
                        <NumInput decimal value={f.rate} onChange={(v) => set("rate", v)} suffix="٪ سالانه" />
                      </Field>
                      <Field label="تعداد اقساط" error={err("count")}>
                        <NumInput value={f.count} onChange={(v) => set("count", v)} suffix="قسط" />
                      </Field>
                      <Field label="تاریخ اولین قسط">
                        <JalaliDatePicker value={f.start} onChange={(v) => set("start", v)} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="دوره پرداخت">
                        <Segmented
                          className="w-full"
                          value={f.intervalType}
                          onChange={(v) => set("intervalType", v)}
                          options={(["monthly", "weekly", "days"] as const).map((v) => ({ value: v, label: INTERVAL_LABEL[v] }))}
                        />
                      </Field>
                      <Field label={f.intervalType === "monthly" ? "هر چند ماه" : f.intervalType === "weekly" ? "هر چند هفته" : "هر چند روز"}>
                        <NumInput value={f.intervalValue} onChange={(v) => set("intervalValue", v)} suffix={f.intervalType === "monthly" ? "ماه" : f.intervalType === "weekly" ? "هفته" : "روز"} />
                      </Field>
                    </div>
                    <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[14px] font-semibold">مبلغ هر قسط</div>
                          <div className="text-xs text-muted">{f.overrideOn ? "مبلغ دلخواه شما برای همه اقساط" : "به‌صورت خودکار محاسبه می‌شود"}</div>
                        </div>
                        <label className="flex items-center gap-2 text-[13px] text-muted">
                          تغییر دستی
                          <Switch checked={f.overrideOn} onCheckedChange={(v) => set("overrideOn", v)} />
                        </label>
                      </div>
                      <div className="mt-3">
                        {f.overrideOn ? (
                          <MoneyInput value={f.overrideAmount} onChange={(v) => set("overrideAmount", v)} chips={false} />
                        ) : (
                          <div className="flex items-center gap-2 text-lg font-extrabold text-accent-ink num">
                            <Sparkles size={18} /> {schedule ? formatToman(schedule.installmentAmount) : "—"}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && schedule && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <Stat label="مجموع قابل پرداخت" value={formatToman(schedule.totalPayable)} />
                      <Stat label="مجموع سود / کارمزد" value={formatToman(schedule.totalProfit)} tone={schedule.totalProfit > 0 ? "warn" : undefined} />
                      <Stat label="مبلغ هر قسط" value={formatToman(schedule.installmentAmount)} tone="accent" />
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-line">
                      <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-[13.5px]">
                          <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
                            <tr>
                              <th className="px-4 py-2 text-start font-medium">#</th>
                              <th className="px-4 py-2 text-start font-medium">تاریخ سررسید</th>
                              <th className="px-4 py-2 text-start font-medium">مبلغ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.items.map((it) => {
                              const keptRow = kept.find((k) => k.seq === it.seq);
                              return (
                                <tr key={it.seq} className={cn("border-t border-line", keptRow && "bg-accent-soft/40")}>
                                  <td className="px-4 py-2 text-muted num">{toFaDigits(it.seq)}</td>
                                  <td className="px-4 py-2">
                                    <span className="num">{formatJalaliLong(keptRow?.due_date ?? it.due_date)}</span>
                                  </td>
                                  <td className="px-4 py-2 font-medium num">
                                    {formatToman(keptRow?.amount ?? it.amount)}
                                    {keptRow && <span className="ms-2 text-xs text-accent-ink">(پرداخت‌شده - حفظ می‌شود)</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Live preview panel */}
          <aside className="hidden w-[300px] shrink-0 flex-col gap-4 border-s border-line bg-surface-2/40 p-5 md:flex">
            <div className="text-xs font-semibold text-muted">پیش‌نمایش زنده</div>
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-soft">
              <PlanIcon icon={f.icon} color={f.color} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-bold">{f.title || "عنوان قسط"}</div>
                <div className="truncate text-xs text-muted">{f.counterparty || DIRECTION_LABEL[f.direction]}</div>
              </div>
            </div>
            {schedule ? (
              <div className="flex flex-col gap-2.5 text-[13px]">
                <Row k="مبلغ تأمین‌شده" v={formatToman(schedule.financed)} />
                <Row k="مبلغ هر قسط" v={formatToman(schedule.installmentAmount)} strong />
                <Row k="تعداد" v={`${toFaDigits(count)} قسط`} />
                <Row k="اولین قسط" v={`${formatJalaliShort(schedule.items[0].due_date)} (${relativeLabel(schedule.items[0].due_date)})`} />
                <Row k="آخرین قسط" v={formatJalaliShort(schedule.items[schedule.items.length - 1].due_date)} />
                <div className="my-1 h-px bg-line" />
                <Row k="مجموع پرداختی" v={formatToman(schedule.totalPayable)} strong />
                <Row k="سود / کارمزد" v={formatToman(schedule.totalProfit)} />
              </div>
            ) : (
              <p className="text-[13px] leading-7 text-muted">با وارد کردن مبلغ و تعداد اقساط، محاسبات اینجا نمایش داده می‌شود.</p>
            )}
          </aside>
        </div>

        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <Button variant="ghost" onClick={step === 0 ? close : back}>
            {step === 0 ? "انصراف" : (<><ArrowRight size={17} /> مرحله قبل</>)}
          </Button>
          {step < 2 ? (
            <Button variant="primary" onClick={next}>
              مرحله بعد <ArrowLeft size={17} />
            </Button>
          ) : (
            <Button variant="primary" onClick={onSave} disabled={busy || !schedule}>
              <Check size={17} /> {editing ? "ذخیره تغییرات" : "ایجاد قسط"}
            </Button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="بازتولید اقساط پرداخت‌نشده"
        description={`این قسط دارای ${toFaDigits(kept.length)} پرداخت ثبت‌شده است. اقساط پرداخت‌شده بدون تغییر می‌مانند و اقساط پرداخت‌نشده بر اساس اطلاعات جدید دوباره ساخته می‌شوند. ادامه می‌دهید؟`}
        confirmLabel="بله، ذخیره کن"
        onConfirm={doSave}
      />
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "accent" | "warn" }) {
  return (
    <div className={cn("rounded-2xl border border-line p-3.5", tone === "accent" ? "bg-accent-soft" : tone === "warn" ? "bg-warn-soft" : "bg-surface-2/50")}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-extrabold num">{value}</div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={cn("text-end num", strong && "font-extrabold")}>{v}</span>
    </div>
  );
}
