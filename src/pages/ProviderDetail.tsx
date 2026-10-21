import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import {
  AlertTriangle, Archive, ArchiveRestore, ArrowRight, Check, ChevronDown, Layers, MoreVertical, Pencil, Plus, Receipt, ShoppingBag, Store, Trash2, Undo2, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { usePlans } from "../store/usePlans";
import { useUI } from "../store/useUI";
import { useDerived } from "../lib/useDerived";
import { summarizeProvider } from "../lib/creditUsage";
import { computePlanStats } from "../lib/derive";
import { STATEMENT_STATE_LABEL, statementForPurchase, type StatementState, type StatementView } from "../lib/cycles";
import { payStatementView } from "../lib/actions";
import { generateSplit } from "../lib/schedule";
import { formatDayMonth, formatJalaliMedium, formatJalaliShort, relativeLabel, todayISO } from "../lib/jalali";
import { formatToman, formatTomanCompact } from "../lib/money";
import { parseIntInput, toFaDigits } from "../lib/digits";
import { formToProvider, providerFormErrors, providerToForm } from "../lib/providerForm";
import type { Charge, FeeType, Provider } from "../lib/types";
import type { IntervalType } from "../lib/schedule";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog, Modal } from "../components/ui/Dialog";
import { EmptyState, Segmented } from "../components/ui/Misc";
import { Field, Input, NumInput } from "../components/ui/Input";
import { MoneyInput } from "../components/ui/MoneyInput";
import { JalaliDatePicker } from "../components/ui/JalaliDatePicker";
import { PlanIcon } from "../components/ui/PlanIcon";
import { CreditBar } from "../components/CreditBar";
import { FeeFields } from "../components/FeeFields";
import { PlanCard } from "../components/PlanCard";
import { PayAmountDialog } from "../components/InstallmentDialogs";
import { ProviderForm, useProviderForm } from "../components/ProviderDialog";
import { ProviderModeBadges } from "./Providers";
import { INTERVAL_LABEL } from "../lib/constants";
import { cn } from "../lib/utils";

type Tab = "plans" | "statements" | "charges" | "settings";

const menuItem = "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] outline-none data-[highlighted]:bg-surface-2";

const stateTone: Record<StatementState, "info" | "warn" | "danger" | "accent" | "neutral"> = {
  open: "info",
  due: "warn",
  overdue: "danger",
  partial: "info",
  paid: "accent",
  split: "neutral",
};

export function ProviderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const providers = usePlans((s) => s.providers);
  const plans = usePlans((s) => s.plans);
  const saveProvider = usePlans((s) => s.saveProvider);
  const deleteProvider = usePlans((s) => s.deleteProvider);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const openProviderDialog = useUI((s) => s.openProviderDialog);
  const { today, dueItems, statementViews } = useDerived();
  const [delOpen, setDelOpen] = useState(false);

  const provider = providers.find((p) => p.id === Number(id));
  const views = useMemo(() => statementViews.filter((v) => v.providerId === provider?.id), [statementViews, provider]);
  const myPlans = useMemo(() => plans.filter((p) => p.provider_id === provider?.id), [plans, provider]);
  const charges = usePlans((s) => s.charges);
  const myCharges = useMemo(() => charges.filter((c) => c.provider_id === provider?.id).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id), [charges, provider]);

  if (!provider) {
    return (
      <div className="rounded-3xl border border-dashed border-line bg-surface/60">
        <EmptyState icon={<Store size={38} />} title="این ارائه‌دهنده پیدا نشد" description="ممکن است حذف شده باشد." action={{ label: "بازگشت به ارائه‌دهندگان", onClick: () => nav("/providers") }} />
      </div>
    );
  }

  const sum = summarizeProvider(provider, dueItems, today);
  const showPlansTab = !!provider.supports_split || myPlans.length > 0;
  const showStatementTabs = !!provider.supports_statement || views.some((v) => v.charges.length > 0) || myCharges.length > 0;
  const tabs: { value: Tab; label: string }[] = [
    ...(showPlansTab ? [{ value: "plans" as const, label: "خریدهای قسطی" }] : []),
    ...(showStatementTabs ? [{ value: "statements" as const, label: "صورتحساب‌ها" }, { value: "charges" as const, label: "خریدهای صورتحساب" }] : []),
    { value: "settings", label: "تنظیمات" },
  ];
  const wanted = sp.get("tab") as Tab | null;
  const tab: Tab = tabs.find((t) => t.value === wanted)?.value ?? tabs[0].value;
  const setTab = (t: Tab) => setSp({ tab: t }, { replace: true });

  return (
    <div>
      <Link to="/providers" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-fg">
        <ArrowRight size={15} /> بازگشت به ارائه‌دهندگان
      </Link>

      {/* Header */}
      <Card className="relative mb-5 overflow-hidden p-6">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: provider.color }} />
        <div className="flex items-start gap-4">
          <PlanIcon icon={provider.icon} color={provider.color} size={60} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[22px] font-extrabold tracking-tight">{provider.name}</h1>
              <ProviderModeBadges p={provider} />
              {provider.archived ? <Badge>بایگانی</Badge> : null}
              {sum.overdueCount > 0 && (
                <Badge tone="danger">
                  <AlertTriangle size={12} /> <span className="num">{toFaDigits(sum.overdueCount)}</span> مورد معوق
                </Badge>
              )}
            </div>
            {provider.notes && <div className="selectable mt-1 text-[13px] text-muted">{provider.notes}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="primary" onClick={() => openQuickAdd(provider.id)}>
              <ShoppingBag size={17} /> خرید جدید
            </Button>
            <Button variant="secondary" onClick={() => openProviderDialog(provider.id)}>
              <Pencil size={16} /> ویرایش
            </Button>
            <DropdownMenu.Root dir="rtl">
              <DropdownMenu.Trigger asChild>
                <Button variant="secondary" size="icon" aria-label="بیشتر">
                  <MoreVertical size={18} />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="start" sideOffset={6} className="pop-anim z-[70] min-w-48 rounded-xl border border-line bg-surface p-1 shadow-pop">
                  <DropdownMenu.Item
                    className={menuItem}
                    onSelect={async () => {
                      await saveProvider(provider.id, { archived: provider.archived ? 0 : 1 });
                      toast.success(provider.archived ? "از بایگانی خارج شد" : "بایگانی شد");
                    }}
                  >
                    {provider.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    {provider.archived ? "خارج کردن از بایگانی" : "بایگانی"}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Item className={cn(menuItem, "text-danger-ink")} onSelect={() => setDelOpen(true)}>
                    <Trash2 size={16} /> حذف ارائه‌دهنده
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_1fr_1.3fr] gap-4">
          <div className="rounded-2xl bg-surface-2/60 p-4">
            <div className="text-xs text-muted">مانده کل</div>
            <div className="mt-1 whitespace-nowrap text-[18px] font-extrabold num">{formatToman(sum.outstanding)}</div>
          </div>
          <div className="min-w-0 rounded-2xl bg-surface-2/60 p-4">
            <div className="text-xs text-muted">سررسید بعدی</div>
            {sum.next ? (
              <>
                <div className="mt-1 truncate whitespace-nowrap text-[16px] font-extrabold num">{formatJalaliShort(sum.next.dueDate)}</div>
                <div className="mt-0.5 truncate whitespace-nowrap text-xs text-muted num">
                  {sum.next.kind === "statement" ? (sum.next.open ? "صورتحساب جاری" : "صورتحساب") : `قسط ${toFaDigits(sum.next.seq ?? 0)}`} · {relativeLabel(sum.next.dueDate, today)} · {formatTomanCompact(sum.next.remaining)}
                </div>
              </>
            ) : (
              <div className="mt-1 text-[14px] font-semibold text-accent-ink">همه پرداخت شده</div>
            )}
          </div>
          <div className="flex flex-col justify-center rounded-2xl bg-surface-2/60 p-4">
            <CreditBar usage={sum.usage} />
          </div>
        </div>
      </Card>

      <div className="mb-4">
        <Segmented value={tab} onChange={setTab} options={tabs} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === "plans" && <PlansTab provider={provider} />}
          {tab === "statements" && <StatementsTab provider={provider} views={views} />}
          {tab === "charges" && <ChargesTab provider={provider} charges={myCharges} views={views} />}
          {tab === "settings" && <SettingsTab key={provider.id} provider={provider} />}
        </motion.div>
      </AnimatePresence>

      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        danger
        title="حذف این ارائه‌دهنده؟"
        description={`«${provider.name}» با همهٔ خریدها و صورتحساب‌هایش حذف می‌شود. ${toFaDigits(myPlans.length)} برنامهٔ اقساط این ارائه‌دهنده بدون تغییر می‌ماند. این کار قابل بازگشت نیست.`}
        confirmLabel="حذف دائمی"
        onConfirm={async () => {
          await deleteProvider(provider.id);
          toast.success("ارائه‌دهنده حذف شد");
          nav("/providers");
        }}
      />
    </div>
  );
}

/* ------------------------------- split purchases ------------------------------- */

function PlansTab({ provider }: { provider: Provider }) {
  const plans = usePlans((s) => s.plans);
  const installments = usePlans((s) => s.installments);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const today = todayISO();
  const [filter, setFilter] = useState<"active" | "finished">("active");
  const stats = useMemo(
    () => plans.filter((p) => p.provider_id === provider.id && !p.archived).map((p) => computePlanStats(p, installments, today)).sort((a, b) => b.plan.id - a.plan.id),
    [plans, installments, provider.id, today],
  );
  const active = stats.filter((s) => !s.finished);
  const finished = stats.filter((s) => s.finished);
  const list = filter === "active" ? active : finished;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: `فعال (${toFaDigits(active.length)})` },
            { value: "finished", label: `تمام‌شده (${toFaDigits(finished.length)})` },
          ]}
        />
        {provider.supports_split ? (
          <Button variant="soft" onClick={() => openQuickAdd(provider.id)}>
            <Plus size={16} /> خرید تقسیطی جدید
          </Button>
        ) : null}
      </div>
      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface/60">
          <EmptyState
            icon={<Wallet size={34} />}
            title={filter === "active" ? "خرید تقسیطی فعالی ندارید" : "هنوز خرید تمام‌شده‌ای نیست"}
            description={filter === "active" ? "با «خرید جدید» یک خرید تقسیطی ثبت کنید؛ برنامهٔ اقساط به‌صورت خودکار ساخته می‌شود." : undefined}
            action={filter === "active" && provider.supports_split ? { label: "خرید جدید", onClick: () => openQuickAdd(provider.id) } : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4">
          {list.map((s, i) => (
            <PlanCard key={s.plan.id} s={s} index={i} provider={provider} />
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- statements --------------------------------- */

function StatementsTab({ provider, views }: { provider: Provider; views: StatementView[] }) {
  const setStatementPayment = usePlans((s) => s.setStatementPayment);
  const [payFor, setPayFor] = useState<StatementView | null>(null);
  const [splitFor, setSplitFor] = useState<StatementView | null>(null);
  // Explicit open/closed choice per statement; the running cycle at the top starts expanded.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const shown = views.filter((v) => v.charges.length > 0 || v.state === "open" || v.paidAmount > 0 || v.splitPlanId != null);

  if (!provider.supports_statement && shown.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line bg-surface/60">
        <EmptyState icon={<Receipt size={34} />} title="صورتحساب ماهانه فعال نیست" description="در تب «تنظیمات» صورتحساب ماهانه را فعال کنید." />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {shown.map((v, i) => (
        <StatementCard
          key={v.key}
          v={v}
          provider={provider}
          index={i}
          open={expanded[v.key] ?? (i === 0 && v.state === "open")}
          onToggle={() => setExpanded((x) => ({ ...x, [v.key]: !(x[v.key] ?? (i === 0 && v.state === "open")) }))}
          onPay={() => void payStatementView(v)}
          onPartial={() => setPayFor(v)}
          onSplit={() => setSplitFor(v)}
          onUndo={async () => {
            await setStatementPayment(v, 0, null);
            toast("پرداخت بازگردانده شد");
          }}
        />
      ))}
      <PayAmountDialog
        open={!!payFor}
        title="پرداخت صورتحساب"
        description={payFor ? `مانده: ${formatToman(payFor.remaining)}` : undefined}
        remaining={payFor?.remaining ?? 0}
        onClose={() => setPayFor(null)}
        onSubmit={async (amount, date) => {
          if (!payFor) return;
          const newPaid = Math.min(payFor.amount, payFor.paidAmount + amount);
          await setStatementPayment(payFor, newPaid, date);
          toast.success(newPaid >= payFor.amount ? "صورتحساب پرداخت شد" : "پرداخت جزئی ثبت شد");
          setPayFor(null);
        }}
      />
      <SplitStatementDialog v={splitFor} provider={provider} onClose={() => setSplitFor(null)} />
    </div>
  );
}

function StatementCard({
  v, provider, index, open, onToggle, onPay, onPartial, onSplit, onUndo,
}: {
  v: StatementView; provider: Provider; index: number; open: boolean;
  onToggle: () => void; onPay: () => void; onPartial: () => void; onSplit: () => void; onUndo: () => void;
}) {
  const today = todayISO();
  const deletePlan = usePlans((s) => s.deletePlan);
  const [unsplit, setUnsplit] = useState(false);
  const payable = v.state === "due" || v.state === "overdue" || v.state === "partial";
  const isOpen = v.state === "open";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.03 }}>
      <Card className={cn("overflow-hidden", isOpen && "ring-1 ring-info/40", v.state === "overdue" && "ring-1 ring-danger/40")}>
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-start transition-colors hover:bg-surface-2/40">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `color-mix(in srgb, ${provider.color} 16%, transparent)`, color: provider.color }}>
            <Receipt size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate whitespace-nowrap text-[15px] font-bold num">
                {formatDayMonth(v.start)} تا {formatJalaliMedium(v.end)}
              </span>
              <Badge tone={stateTone[v.state]} className="shrink-0">
                {STATEMENT_STATE_LABEL[v.state]}
              </Badge>
            </div>
            <div className="mt-0.5 truncate whitespace-nowrap text-xs text-muted num">
              {isOpen ? `بسته شدن ${formatJalaliMedium(v.end)} (${relativeLabel(v.end, today)}) · ` : ""}
              سررسید {formatJalaliMedium(v.dueDate)}
              {!isOpen && v.state !== "paid" && v.state !== "split" ? ` (${relativeLabel(v.dueDate, today)})` : ""}
              {" · "}
              <span>{toFaDigits(v.charges.length)} خرید</span>
            </div>
          </div>
          <div className="shrink-0 whitespace-nowrap text-end">
            <div className={cn("text-[16px] font-extrabold num", v.state === "paid" && "text-muted line-through", v.state === "split" && "text-muted")}>{formatToman(v.amount)}</div>
            {v.paidAmount > 0 && v.state !== "paid" && v.state !== "split" && <div className="text-xs text-accent-ink num">پرداخت‌شده {formatTomanCompact(v.paidAmount)}</div>}
            {isOpen && <div className="text-xs text-muted">تا این لحظه</div>}
          </div>
          <ChevronDown size={18} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="border-t border-line px-5 py-4">
                {v.reopened && (
                  <div className="mb-3 flex gap-2.5 rounded-xl bg-warn-soft px-4 py-2.5 text-[13px] text-warn-ink">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                    پس از پرداخت این صورتحساب، خرید جدیدی با تاریخ همین دوره ثبت شد و صورتحساب دوباره «پرداخت ناقص» شد.
                  </div>
                )}
                {isOpen && (
                  <div className="mb-3 rounded-xl bg-info-soft px-4 py-2.5 text-[13px] text-info-ink">
                    این دوره هنوز بسته نشده است؛ خریدهای جدید به همین صورتحساب اضافه می‌شود.
                  </div>
                )}
                {v.charges.length === 0 ? (
                  <div className="py-4 text-center text-[13px] text-muted">خریدی در این دوره ثبت نشده است.</div>
                ) : (
                  <div className="flex flex-col divide-y divide-line">
                    {v.charges.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                        <span className="w-24 shrink-0 whitespace-nowrap text-muted num">{formatJalaliShort(c.date)}</span>
                        <span className="min-w-0 flex-1 truncate">{c.title || c.store || "خرید"}</span>
                        <span className="shrink-0 whitespace-nowrap font-semibold num">{formatToman(c.amount)}</span>
                      </div>
                    ))}
                    {v.fee > 0 && (
                      <div className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                        <span className="w-24 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-muted">کارمزد صورتحساب</span>
                        <span className="shrink-0 whitespace-nowrap font-semibold num">{formatToman(v.fee)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {payable && (
                    <>
                      <Button variant="primary" size="sm" onClick={onPay}>
                        <Check size={15} /> پرداخت کامل ({formatTomanCompact(v.remaining)})
                      </Button>
                      <Button variant="soft" size="sm" onClick={onPartial}>
                        <Wallet size={15} /> پرداخت جزئی
                      </Button>
                      <Button variant="secondary" size="sm" onClick={onSplit}>
                        <Layers size={15} /> تقسیط این صورتحساب
                      </Button>
                    </>
                  )}
                  {v.paidAmount > 0 && v.state !== "split" && (
                    <Button variant="ghost" size="sm" onClick={onUndo}>
                      <Undo2 size={15} /> بازگردانی پرداخت
                    </Button>
                  )}
                  {v.state === "split" && v.splitPlanId != null && (
                    <>
                      <Link to={`/plans/${v.splitPlanId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-soft px-3 text-[13px] font-medium text-accent-ink">
                        مشاهدهٔ اقساط
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setUnsplit(true)}>
                        <Undo2 size={15} /> لغو تقسیط
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
      <ConfirmDialog
        open={unsplit}
        onOpenChange={setUnsplit}
        title="لغو تقسیط صورتحساب؟"
        description="برنامهٔ اقساط ساخته‌شده حذف می‌شود و صورتحساب دوباره به‌صورت یک سررسید نمایش داده می‌شود."
        confirmLabel="لغو تقسیط"
        onConfirm={async () => {
          if (v.splitPlanId != null) await deletePlan(v.splitPlanId);
          toast.success("تقسیط لغو شد");
        }}
      />
    </motion.div>
  );
}

function SplitStatementDialog({ v, provider, onClose }: { v: StatementView | null; provider: Provider; onClose: () => void }) {
  const splitStatement = usePlans((s) => s.splitStatement);
  const nav = useNavigate();
  const [parts, setParts] = useState("3");
  const [intervalType, setIntervalType] = useState<IntervalType>("monthly");
  const [intervalValue, setIntervalValue] = useState("1");
  const [feeType, setFeeType] = useState<FeeType>("none");
  const [feeValue, setFeeValue] = useState("0");
  const [lastKey, setLastKey] = useState<string | null>(null);

  if (v && lastKey !== v.key) {
    setLastKey(v.key);
    setParts(String(Math.max(2, provider.preset_parts)));
    setIntervalType(provider.preset_interval_type);
    setIntervalValue(String(provider.preset_interval_value));
    setFeeType(provider.preset_fee_type);
    setFeeValue(String(provider.preset_fee_value));
  }
  if (!v && lastKey) setLastKey(null);

  const n = parseIntInput(parts);
  const iv = Math.max(1, parseIntInput(intervalValue));
  const fv = Number(feeValue) || 0;
  const valid = !!v && v.remaining > 0 && n >= 1 && n <= 36;
  const preview = useMemo(() => {
    if (!v || !valid) return null;
    return generateSplit({ amount: v.remaining, parts: n, intervalType, intervalValue: iv, firstAtPurchase: false, purchaseDate: todayISO(), feeType, feeValue: fv });
  }, [v, valid, n, intervalType, iv, feeType, fv]);

  return (
    <Modal
      open={!!v}
      onOpenChange={(o) => !o && onClose()}
      title="تقسیط صورتحساب"
      description={v ? `مانده ${formatToman(v.remaining)} به چند قسط تبدیل شود؟` : undefined}
      className="w-[min(600px,96vw)]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5" style={{ maxHeight: "70vh" }}>
        <div className="grid grid-cols-3 gap-4">
          <Field label="تعداد اقساط">
            <NumInput value={parts} onChange={setParts} suffix="قسط" />
          </Field>
          <Field label="دوره پرداخت">
            <Segmented
              className="w-full"
              value={intervalType}
              onChange={setIntervalType}
              options={(["monthly", "weekly", "days"] as const).map((x) => ({ value: x, label: INTERVAL_LABEL[x] }))}
            />
          </Field>
          <Field label="هر چند">
            <NumInput value={intervalValue} onChange={setIntervalValue} suffix={intervalType === "monthly" ? "ماه" : intervalType === "weekly" ? "هفته" : "روز"} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FeeFields type={feeType} value={feeValue} onType={setFeeType} onValue={setFeeValue} label="کارمزد تقسیط" percentOf="مانده صورتحساب" />
        </div>
        <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
          {preview ? (
            <>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
                <span className="whitespace-nowrap">{preview.fee > 0 ? `شامل کارمزد ${formatToman(preview.fee)}` : "بدون کارمزد"}</span>
                <span className="whitespace-nowrap font-semibold text-fg num">{formatToman(preview.total)}</span>
              </div>
              <div className="grid max-h-40 grid-cols-2 gap-x-6 gap-y-1.5 overflow-y-auto">
                {preview.items.map((it) => (
                  <div key={it.seq} className="flex items-center justify-between gap-2 whitespace-nowrap text-[13px]">
                    <span className="text-muted num">{toFaDigits(it.seq)}. {formatJalaliShort(it.due_date)}</span>
                    <span className="font-semibold num">{formatToman(it.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted">تعداد اقساط را وارد کنید.</p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
        <Button variant="secondary" onClick={onClose}>انصراف</Button>
        <Button
          variant="primary"
          disabled={!valid}
          onClick={async () => {
            if (!v) return;
            const planId = await splitStatement(v, provider, { parts: n, intervalType, intervalValue: iv, feeType, feeValue: fv });
            toast.success("صورتحساب تقسیط شد", { action: { label: "مشاهده اقساط", onClick: () => nav(`/plans/${planId}`) } });
            onClose();
          }}
        >
          <Layers size={16} /> تقسیط کن
        </Button>
      </div>
    </Modal>
  );
}

/* ----------------------------------- charges ----------------------------------- */

function ChargesTab({ provider, charges, views }: { provider: Provider; charges: Charge[]; views: StatementView[] }) {
  const removeCharge = usePlans((s) => s.removeCharge);
  const [editFor, setEditFor] = useState<Charge | "new" | null>(null);
  const [delFor, setDelFor] = useState<Charge | null>(null);
  const viewOf = (c: Charge) => views.find((v) => v.charges.some((x) => x.id === c.id));
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[13px] text-muted">
          <span className="num">{toFaDigits(charges.length)}</span> خرید ثبت‌شده
        </div>
        <Button variant="primary" disabled={provider.statement_close_day == null} onClick={() => setEditFor("new")}>
          <Plus size={16} /> افزودن خرید
        </Button>
      </div>
      {charges.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface/60">
          <EmptyState
            icon={<Receipt size={34} />}
            title="هنوز خریدی روی صورتحساب نیست"
            description="خریدهای کوچک را اینجا ثبت کنید؛ هر ماه جمع آن‌ها در یک صورتحساب سررسید می‌شود."
            action={provider.statement_close_day != null ? { label: "افزودن خرید", onClick: () => setEditFor("new") } : undefined}
          />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full table-fixed text-[13.5px]">
            <thead className="bg-surface-2/60 text-xs text-muted">
              <tr>
                <th className="w-32 px-5 py-2.5 text-start font-medium">تاریخ</th>
                <th className="px-3 py-2.5 text-start font-medium">فروشگاه / عنوان</th>
                <th className="w-44 px-3 py-2.5 text-start font-medium">صورتحساب</th>
                <th className="w-44 px-3 py-2.5 text-start font-medium">مبلغ</th>
                <th className="w-24 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {charges.map((c) => {
                const v = viewOf(c);
                return (
                  <tr key={c.id} className="border-t border-line transition-colors hover:bg-surface-2/50">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted num">{formatJalaliShort(c.date)}</td>
                    <td className="truncate px-3 py-2.5 font-medium">
                      {c.title || c.store || "خرید"}
                      {c.title && c.store && c.title !== c.store && <span className="ms-2 text-xs font-normal text-muted">{c.store}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted num">{v ? `تا ${formatDayMonth(v.end)}` : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold num">{formatToman(c.amount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8" aria-label="ویرایش" onClick={() => setEditFor(c)}>
                          <Pencil size={15} />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8 hover:text-danger-ink" aria-label="حذف" onClick={() => setDelFor(c)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <ChargeDialog provider={provider} target={editFor} onClose={() => setEditFor(null)} />
      <ConfirmDialog
        open={!!delFor}
        onOpenChange={(o) => !o && setDelFor(null)}
        danger
        title="حذف این خرید؟"
        description={delFor ? `خرید ${formatToman(delFor.amount)} از صورتحساب حذف می‌شود و جمع صورتحساب کم می‌شود.` : ""}
        confirmLabel="حذف"
        onConfirm={async () => {
          if (delFor) await removeCharge(delFor.id);
          toast.success("خرید حذف شد");
        }}
      />
    </div>
  );
}

function ChargeDialog({ provider, target, onClose }: { provider: Provider; target: Charge | "new" | null; onClose: () => void }) {
  const addCharge = usePlans((s) => s.addCharge);
  const saveCharge = usePlans((s) => s.saveCharge);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [store, setStore] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [key, setKey] = useState<string | null>(null);

  const k = target === null ? null : target === "new" ? "new" : String(target.id);
  if (k !== key) {
    setKey(k);
    if (target && target !== "new") {
      setAmount(target.amount);
      setDate(target.date);
      setStore(target.store ?? "");
      setTitle(target.title ?? "");
      setNote(target.note ?? "");
    } else if (target === "new") {
      setAmount(0);
      setDate(todayISO());
      setStore("");
      setTitle("");
      setNote("");
    }
  }
  const info = provider.statement_close_day != null ? statementForPurchase(date, provider.statement_close_day, provider.statement_due_offset ?? 0) : null;
  const editing = target && target !== "new" ? target : null;

  const submit = async () => {
    if (amount <= 0) return;
    const data = { provider_id: provider.id, date, amount, store: store.trim() || null, title: title.trim() || null, note: note.trim() || null };
    if (editing) {
      await saveCharge(editing.id, data);
      toast.success("خرید ویرایش شد");
    } else {
      await addCharge(data);
      toast.success("خرید اضافه شد");
    }
    onClose();
  };

  return (
    <Modal open={!!target} onOpenChange={(o) => !o && onClose()} title={editing ? "ویرایش خرید" : "خرید جدید روی صورتحساب"} description={provider.name}>
      <div
        className="flex flex-col gap-4 px-6 py-5"
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            void submit();
          }
        }}
      >
        <div className="grid grid-cols-[1fr_180px] gap-4">
          <Field label="مبلغ">
            <MoneyInput value={amount} onChange={setAmount} chips={false} autoFocus />
          </Field>
          <Field label="تاریخ">
            <JalaliDatePicker value={date} onChange={setDate} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="فروشگاه">
            <Input value={store} onChange={(e) => setStore(e.target.value)} placeholder="اختیاری" />
          </Field>
          <Field label="عنوان">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اختیاری" />
          </Field>
        </div>
        <Field label="یادداشت">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختیاری" />
        </Field>
        {info && (
          <div className="rounded-xl bg-surface-2/70 px-4 py-2.5 text-[13px] text-muted num">
            این خرید در صورتحساب <b className="text-fg">{formatDayMonth(info.closeDate)}</b> قرار می‌گیرد · سررسید <b className="text-fg">{formatJalaliMedium(info.dueDate)}</b>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>انصراف</Button>
          <Button variant="primary" disabled={amount <= 0} onClick={() => void submit()}>
            <Check size={16} /> {editing ? "ذخیره" : "افزودن"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------- settings ----------------------------------- */

function SettingsTab({ provider }: { provider: Provider }) {
  const saveProvider = usePlans((s) => s.saveProvider);
  const { f, setF, set } = useProviderForm(() => providerToForm(provider));
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(JSON.stringify(providerToForm(provider)));
  const dirty = JSON.stringify(f) !== saved;
  const valid = !Object.values(providerFormErrors(f)).some(Boolean);
  return (
    <Card className="p-6">
      <ProviderForm f={f} set={set} sections={["modes", "preset", "statement"]} showErrors={touched} />
      <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
        {dirty && (
          <Button variant="ghost" onClick={() => setF(JSON.parse(saved))}>
            انصراف از تغییرات
          </Button>
        )}
        <Button
          variant="primary"
          disabled={!dirty}
          onClick={async () => {
            if (!valid) return setTouched(true);
            await saveProvider(provider.id, formToProvider(f, provider.archived));
            setSaved(JSON.stringify(f));
            toast.success("تنظیمات ذخیره شد");
          }}
        >
          <Check size={16} /> ذخیره تنظیمات
        </Button>
      </div>
    </Card>
  );
}
