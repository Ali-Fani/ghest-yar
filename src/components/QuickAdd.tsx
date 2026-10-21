import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CornerDownLeft, Receipt, Layers, Store } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Modal } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Field, Input } from "./ui/Input";
import { MoneyInput } from "./ui/MoneyInput";
import { JalaliDatePicker } from "./ui/JalaliDatePicker";
import { Segmented } from "./ui/Misc";
import { PlanIcon } from "./ui/PlanIcon";
import { EmptyState } from "./ui/Misc";
import { usePlans } from "../store/usePlans";
import { useSettings } from "../store/useSettings";
import { useUI } from "../store/useUI";
import { useDerived } from "../lib/useDerived";
import { buildSplitPlan, presetOf } from "../lib/purchase";
import { buildStatements, statementForPurchase } from "../lib/cycles";
import { formatJalaliMedium, formatJalaliShort, relativeLabel, todayISO } from "../lib/jalali";
import { formatToman } from "../lib/money";
import { toFaDigits } from "../lib/digits";
import type { Provider } from "../lib/types";
import { cn } from "../lib/utils";

type Mode = "split" | "statement";

const recentIds = (raw: string | undefined): number[] =>
  (raw ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0);

/** Fast entry for purchases: provider chips, amount, store, date, mode, live preview. Ctrl+Shift+N. */
export function QuickAdd() {
  const open = useUI((s) => s.quickAddOpen);
  const preselect = useUI((s) => s.quickAddProviderId);
  const close = useUI((s) => s.closeQuickAdd);
  const openProviderDialog = useUI((s) => s.openProviderDialog);
  const providers = usePlans((s) => s.providers);
  const addSplitPurchase = usePlans((s) => s.addSplitPurchase);
  const addCharge = usePlans((s) => s.addCharge);
  const getRaw = useSettings((s) => s.getRaw);
  const setRaw = useSettings((s) => s.setRaw);
  const { statementViews } = useDerived();
  const nav = useNavigate();
  const body = useRef<HTMLDivElement>(null);

  const active = useMemo(() => providers.filter((p) => !p.archived), [providers]);
  const ordered = useMemo(() => {
    const rec = recentIds(getRaw("recentProviders"));
    const rank = (id: number) => (rec.indexOf(id) === -1 ? 999 + id : rec.indexOf(id));
    return [...active].sort((a, b) => rank(a.id) - rank(b.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const [providerId, setProviderId] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [text, setText] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<Mode>("split");
  const [busy, setBusy] = useState(false);

  const provider: Provider | undefined = active.find((p) => p.id === providerId);
  const canSplit = !!provider?.supports_split;
  const canStatement = !!provider && !!provider.supports_statement && provider.statement_close_day != null;
  const both = canSplit && canStatement;

  const pickMode = (p: Provider | undefined, want?: Mode): Mode => {
    const split = !!p?.supports_split;
    const st = !!p && !!p.supports_statement && p.statement_close_day != null;
    if (want === "statement" && st) return "statement";
    if (want === "split" && split) return "split";
    return split ? "split" : st ? "statement" : "split";
  };

  useEffect(() => {
    if (!open) return;
    const last = Number(getRaw("lastProviderId"));
    const start = (preselect != null && active.find((p) => p.id === preselect)) || active.find((p) => p.id === last) || ordered[0];
    setProviderId(start?.id ?? null);
    setAmount(0);
    setText("");
    setDate(todayISO());
    setMode(pickMode(start, (getRaw("lastMode") as Mode) || undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (p: Provider) => {
    setProviderId(p.id);
    setMode((m) => pickMode(p, m));
  };

  const effMode = pickMode(provider, mode);

  const split = useMemo(() => {
    if (!provider || effMode !== "split" || amount <= 0) return null;
    return buildSplitPlan(provider, { ...presetOf(provider), amount, date, title: text, store: text }).result;
  }, [provider, effMode, amount, date, text]);

  const stmt = useMemo(() => {
    if (!provider || effMode !== "statement" || !canStatement) return null;
    const info = statementForPurchase(date, provider.statement_close_day as number, provider.statement_due_offset ?? 0);
    const existing = statementViews.find((v) => v.providerId === provider.id && date >= v.start && date <= v.end);
    const before = existing?.chargesTotal ?? 0;
    return { ...info, before, after: before + Math.max(0, amount) };
  }, [provider, effMode, canStatement, date, amount, statementViews]);

  const valid = !!provider && amount > 0 && (effMode === "split" ? canSplit : canStatement);

  const save = async (keepOpen: boolean) => {
    if (!provider || !valid || busy) return;
    setBusy(true);
    try {
      const label = text.trim();
      if (effMode === "split") {
        const id = await addSplitPurchase(provider, { ...presetOf(provider), amount, date, title: label, store: label });
        toast.success("خرید تقسیطی ثبت شد", { description: `${provider.name} · ${formatToman(amount)}`, action: { label: "مشاهده", onClick: () => nav(`/plans/${id}`) } });
      } else {
        await addCharge({ provider_id: provider.id, date, amount, store: label || null, title: label || null, note: null });
        const s = usePlans.getState();
        const view = buildStatements(provider, s.charges, s.statements, todayISO()).find((v) => date >= v.start && date <= v.end);
        if (view?.reopened) {
          toast.warning("این خرید به صورتحساب پرداخت‌شده اضافه شد", { description: "صورتحساب دوباره «پرداخت ناقص» شد." });
        } else {
          toast.success("خرید به صورتحساب اضافه شد", { description: `${provider.name} · ${formatToman(amount)}` });
        }
      }
      const rec = [provider.id, ...recentIds(getRaw("recentProviders")).filter((x) => x !== provider.id)].slice(0, 8);
      void setRaw("recentProviders", rec.join(","));
      void setRaw("lastProviderId", String(provider.id));
      if (both) void setRaw("lastMode", effMode);
      if (keepOpen) {
        setAmount(0);
        setText("");
        setTimeout(() => body.current?.querySelector<HTMLInputElement>("input[inputmode=numeric]")?.focus(), 30);
      } else close();
    } catch (e) {
      console.error(e);
      toast.error("ثبت خرید انجام نشد");
    } finally {
      setBusy(false);
    }
  };

  const noProviders = active.length === 0;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      title="خرید جدید"
      description="ثبت سریع خرید از یک ارائه‌دهنده"
      className="w-[min(620px,96vw)]"
    >
      {noProviders ? (
        <EmptyState
          icon={<Store size={34} />}
          title="هنوز ارائه‌دهنده‌ای ندارید"
          description="برای ثبت خرید، ابتدا ارائه‌دهنده (مثل اسنپ‌پی یا بانک) را اضافه کنید."
          action={{ label: "افزودن ارائه‌دهنده", onClick: () => { close(); openProviderDialog(); } }}
        />
      ) : (
        <>
          <div
            ref={body}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5"
            style={{ maxHeight: "72vh" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && e.target instanceof HTMLInputElement) {
                e.preventDefault();
                void save(false);
              }
            }}
          >
            <Field label="ارائه‌دهنده">
              <div className="flex flex-wrap gap-2">
                {ordered.map((p, i) => {
                  const on = p.id === providerId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => choose(p)}
                      className={cn(
                        "flex max-w-[190px] cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[13px] transition-all",
                        on ? "border-transparent font-semibold shadow-soft" : "border-line bg-surface hover:bg-surface-2",
                      )}
                      style={on ? { background: `color-mix(in srgb, ${p.color} 14%, var(--surface))`, boxShadow: `inset 0 0 0 1.5px ${p.color}` } : undefined}
                      title={i === 0 ? "آخرین ارائه‌دهندهٔ استفاده‌شده" : undefined}
                    >
                      <PlanIcon icon={p.icon} color={p.color} size={24} className="rounded-lg" />
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid grid-cols-[1fr_190px] gap-4">
              <Field label="مبلغ خرید">
                <MoneyInput value={amount} onChange={setAmount} autoFocus chips={false} />
              </Field>
              <Field label="تاریخ">
                <JalaliDatePicker value={date} onChange={setDate} />
              </Field>
            </div>

            <Field label="فروشگاه / عنوان (اختیاری)">
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="مثلاً: فروشگاه اینترنتی، کتاب، غذا" />
            </Field>

            {both && (
              <Segmented<Mode>
                className="w-full"
                value={effMode}
                onChange={setMode}
                options={[
                  { value: "split", label: <><Layers size={15} /> تقسیط (Pay-in-4)</> },
                  { value: "statement", label: <><Receipt size={15} /> به صورتحساب</> },
                ]}
              />
            )}

            {/* live preview */}
            <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
              {effMode === "split" ? (
                !provider || !canSplit ? (
                  <p className="text-[13px] text-muted">این ارائه‌دهنده خرید تقسیطی ندارد.</p>
                ) : split ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
                      <span className="whitespace-nowrap">
                        <span className="num">{toFaDigits(split.items.length)}</span> قسط · {split.fee > 0 ? `شامل کارمزد ${formatToman(split.fee)}` : "بدون کارمزد"}
                      </span>
                      <span className="whitespace-nowrap font-semibold text-fg num">{formatToman(split.total)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 max-h-40 overflow-y-auto">
                      {split.items.map((it) => (
                        <div key={it.seq} className="flex items-center justify-between gap-2 whitespace-nowrap text-[13px]">
                          <span className="flex items-center gap-1.5 text-muted num">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] ring-1 ring-line">{toFaDigits(it.seq)}</span>
                            {formatJalaliShort(it.due_date)}
                          </span>
                          <span className={cn("font-semibold num", it.paid_amount ? "text-accent-ink" : "")}>
                            {it.paid_amount ? <Check size={13} className="me-1 inline" /> : null}
                            {formatToman(it.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-muted">با وارد کردن مبلغ، برنامهٔ اقساط اینجا نمایش داده می‌شود.</p>
                )
              ) : !canStatement || !stmt ? (
                <p className="text-[13px] text-muted">برای این ارائه‌دهنده روز بستن صورتحساب تعریف نشده است.</p>
              ) : (
                <div className="flex flex-col gap-1.5 text-[13px]">
                  <div className="flex items-center justify-between gap-3 whitespace-nowrap">
                    <span className="text-muted">دورهٔ صورتحساب</span>
                    <span className="num">{formatJalaliMedium(stmt.cycle.start)} تا {formatJalaliMedium(stmt.cycle.end)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 whitespace-nowrap">
                    <span className="text-muted">سررسید پرداخت</span>
                    <span className="font-semibold num">
                      {formatJalaliMedium(stmt.dueDate)} <span className="font-normal text-muted">({relativeLabel(stmt.dueDate)})</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 whitespace-nowrap">
                    <span className="text-muted">جمع صورتحساب</span>
                    <span className="num">
                      {stmt.before > 0 && <span className="text-muted">{formatToman(stmt.before)} ← </span>}
                      <b>{formatToman(stmt.after)}</b>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line px-6 py-4">
            <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-muted sm:flex">
              <CornerDownLeft size={13} /> Enter برای ذخیره
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={close}>انصراف</Button>
              <Button variant="soft" disabled={!valid || busy} onClick={() => void save(true)}>ذخیره و بعدی</Button>
              <Button variant="primary" disabled={!valid || busy} onClick={() => void save(false)}>
                <Check size={17} /> ذخیره
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
