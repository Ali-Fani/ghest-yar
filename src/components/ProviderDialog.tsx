import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Modal } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Field, Input, NumInput } from "./ui/Input";
import { MoneyInput } from "./ui/MoneyInput";
import { Segmented, Switch } from "./ui/Misc";
import { ICON_MAP } from "./ui/PlanIcon";
import { FeeFields } from "./FeeFields";
import { INTERVAL_LABEL, PLAN_COLORS, PROVIDER_ICONS, PROVIDER_NAME_CHIPS } from "../lib/constants";
import { emptyProviderForm, formToProvider, providerFormErrors, providerToForm, type ProviderFormState } from "../lib/providerForm";
import { cycleFor, dueDateFor } from "../lib/cycles";
import { addDaysISO, formatDayMonth, formatJalaliShort, todayISO } from "../lib/jalali";
import { parseIntInput, toFaDigits } from "../lib/digits";
import { usePlans } from "../store/usePlans";
import { useUI } from "../store/useUI";
import { cn } from "../lib/utils";

export type SetFn = <K extends keyof ProviderFormState>(k: K, v: ProviderFormState[K]) => void;

export function useProviderForm(initial: () => ProviderFormState) {
  const [f, setF] = useState<ProviderFormState>(initial);
  const set: SetFn = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return { f, setF, set };
}

/** Live example line: «خرید ۱۴۰۵/۰۸/۲۰ ← صورتحساب ۲۵ آبان ← سررسید ۵ آذر» */
export function StatementExample({ closeDay, dueOffset }: { closeDay: number; dueOffset: number }) {
  const cd = Math.min(31, Math.max(1, closeDay || 1));
  const cycle = cycleFor(todayISO(), cd);
  // A sample purchase five days before the close date (never earlier than the cycle start).
  const sample = addDaysISO(cycle.end, -5) < cycle.start ? cycle.start : addDaysISO(cycle.end, -5);
  return (
    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap rounded-xl bg-surface-2/70 px-4 py-3 text-[13px]">
      <span className="shrink-0 text-muted">مثال:</span>
      <span className="shrink-0">
        خرید <b className="num">{formatJalaliShort(sample)}</b>
      </span>
      <span className="shrink-0 text-muted">←</span>
      <span className="shrink-0">
        صورتحساب <b className="num">{formatDayMonth(cycle.end)}</b>
      </span>
      <span className="shrink-0 text-muted">←</span>
      <span className="shrink-0">
        سررسید <b className="num">{formatDayMonth(dueDateFor(cycle, dueOffset))}</b>
      </span>
    </div>
  );
}

function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="border-b border-line pb-2">
      <div className="text-[14px] font-bold">{title}</div>
      {desc && <div className="mt-0.5 text-xs text-muted">{desc}</div>}
    </div>
  );
}

function ModeCard({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors", checked ? "border-accent/50 bg-accent-soft/40" : "border-line bg-surface-2/40")}>
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold">{title}</div>
        <div className="mt-0.5 text-xs leading-5 text-muted">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ProviderForm({
  f,
  set,
  sections,
  creating,
  showErrors,
}: {
  f: ProviderFormState;
  set: SetFn;
  sections: ("identity" | "modes" | "preset" | "statement")[];
  creating?: boolean;
  showErrors?: boolean;
}) {
  const errors = providerFormErrors(f);
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : "");
  return (
    <div className="flex flex-col gap-6">
      {sections.includes("identity") && (
        <div className="flex flex-col gap-5">
          <Field label="نام ارائه‌دهنده" error={err("name")}>
            {creating && (
              <div className="mb-1 flex flex-wrap gap-1.5">
                {[...PROVIDER_NAME_CHIPS, "سفارشی"].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set("name", n === "سفارشی" ? "" : n)}
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                      f.name === n ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface-2 text-muted hover:border-accent hover:text-accent-ink",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            <Input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="مثلاً: نام شرکت یا فروشگاه" />
          </Field>
          <div className="grid grid-cols-2 gap-5">
            <Field label="آیکون">
              <div className="flex flex-wrap gap-2">
                {PROVIDER_ICONS.map((ic) => {
                  const I = ICON_MAP[ic];
                  const active = f.icon === ic;
                  return (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => set("icon", ic)}
                      aria-label={ic}
                      className={cn(
                        "flex size-10 cursor-pointer items-center justify-center rounded-xl border transition-all",
                        active ? "scale-105 border-transparent text-white shadow-soft" : "border-line bg-surface text-muted hover:text-fg",
                      )}
                      style={active ? { background: f.color } : undefined}
                    >
                      <I size={19} />
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
          </div>
          <Field label="سقف اعتبار (اختیاری)">
            <MoneyInput value={f.creditLimit} onChange={(v) => set("creditLimit", v)} />
          </Field>
        </div>
      )}

      {sections.includes("modes") && (
        <div className="flex flex-col gap-3">
          <div className="text-[13px] font-medium text-muted">روش‌های خرید</div>
          <div className="grid grid-cols-2 gap-3">
            <ModeCard title="تقسیطی" desc="هر خرید یک برنامهٔ کوتاه اقساط (مثل Pay-in-4)" checked={f.supportsSplit} onChange={(v) => set("supportsSplit", v)} />
            <ModeCard title="صورتحساب ماهانه" desc="خریدها جمع می‌شوند و یک سررسید در ماه دارند" checked={f.supportsStatement} onChange={(v) => set("supportsStatement", v)} />
          </div>
          {err("mode") && <p className="text-xs text-danger-ink">{err("mode")}</p>}
        </div>
      )}

      {sections.includes("preset") && f.supportsSplit && (
        <div className="flex flex-col gap-4">
          <SectionHead title="تنظیمات خرید تقسیطی" desc="این مقادیر برای هر خرید جدید پیش‌فرض می‌شود و در زمان ثبت قابل تغییر است." />
          <div className="grid grid-cols-3 gap-4">
            <Field label="تعداد اقساط" error={err("parts")}>
              <NumInput value={f.parts} onChange={(v) => set("parts", v)} suffix="قسط" />
            </Field>
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
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-2/50 p-4">
            <div>
              <div className="text-[14px] font-semibold">قسط اول هنگام خرید</div>
              <div className="text-xs text-muted">قسط اول در تاریخ خرید سررسید می‌شود و پرداخت‌شده ثبت می‌شود</div>
            </div>
            <Switch checked={f.firstAtPurchase} onCheckedChange={(v) => set("firstAtPurchase", v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FeeFields type={f.feeType} value={f.feeValue} onType={(t) => set("feeType", t)} onValue={(v) => set("feeValue", v)} percentOf="مبلغ خرید" />
          </div>
        </div>
      )}

      {sections.includes("statement") && f.supportsStatement && (
        <div className="flex flex-col gap-4">
          <SectionHead title="تنظیمات صورتحساب ماهانه" desc="هر ماه یک صورتحساب در روز بستن صادر می‌شود و تا سررسید فرصت پرداخت دارد." />
          <div className="grid grid-cols-2 gap-4">
            <Field label="روز بسته شدن صورتحساب (ماه شمسی)" error={err("closeDay")}>
              <NumInput value={f.closeDay} onChange={(v) => set("closeDay", v)} suffix="ام ماه" />
            </Field>
            <Field label="مهلت پرداخت پس از بستن" error={err("dueOffset")}>
              <NumInput value={f.dueOffset} onChange={(v) => set("dueOffset", v)} suffix="روز" />
            </Field>
            <FeeFields label="کارمزد صورتحساب" type={f.stFeeType} value={f.stFeeValue} onType={(t) => set("stFeeType", t)} onValue={(v) => set("stFeeValue", v)} percentOf="جمع صورتحساب" />
          </div>
          <StatementExample closeDay={parseIntInput(f.closeDay)} dueOffset={parseIntInput(f.dueOffset)} />
          <p className="text-xs leading-6 text-muted">
            اگر روز بستن از طول ماه بیشتر باشد (مثلاً {toFaDigits(31)} در مهر)، صورتحساب در آخرین روز همان ماه بسته می‌شود.
          </p>
        </div>
      )}
    </div>
  );
}

/** Add / edit a provider (identity, modes, presets and statement settings). */
export function ProviderDialog() {
  const open = useUI((s) => s.providerDialogOpen);
  const editId = useUI((s) => s.providerEditId);
  const close = useUI((s) => s.closeProviderDialog);
  const providers = usePlans((s) => s.providers);
  const createProvider = usePlans((s) => s.createProvider);
  const saveProvider = usePlans((s) => s.saveProvider);
  const nav = useNavigate();
  const editing = editId != null ? providers.find((p) => p.id === editId) : undefined;
  const { f, setF, set } = useProviderForm(emptyProviderForm);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setF(editing ? providerToForm(editing) : emptyProviderForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const errors = providerFormErrors(f);
  const valid = !Object.values(errors).some(Boolean);

  const submit = async () => {
    if (!valid) return setTouched(true);
    setBusy(true);
    try {
      if (editing) {
        await saveProvider(editing.id, formToProvider(f, editing.archived));
        toast.success("ارائه‌دهنده ویرایش شد");
      } else {
        const id = await createProvider(formToProvider(f));
        toast.success("ارائه‌دهنده افزوده شد");
        nav(`/providers/${id}`);
      }
      close();
    } catch (e) {
      console.error(e);
      toast.error("ذخیره‌سازی انجام نشد");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      title={editing ? "ویرایش ارائه‌دهنده" : "افزودن ارائه‌دهنده"}
      description={editing ? editing.name : "شرکت، بانک یا فروشگاهی که از آن خرید قسطی می‌کنید"}
      className="w-[min(760px,96vw)]"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5" style={{ maxHeight: "68vh" }}>
        <ProviderForm f={f} set={set} sections={["identity", "modes", "preset", "statement"]} creating={!editing} showErrors={touched} />
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
        <Button variant="ghost" onClick={close}>انصراف</Button>
        <Button variant="primary" disabled={busy} onClick={() => void submit()}>
          <Check size={17} /> {editing ? "ذخیره تغییرات" : "افزودن ارائه‌دهنده"}
        </Button>
      </div>
    </Modal>
  );
}
