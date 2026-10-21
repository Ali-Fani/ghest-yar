import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { Archive, ArchiveRestore, ArrowRight, Check, CheckCheck, MoreVertical, Pencil, StickyNote, Trash2, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { usePlans } from "../store/usePlans";
import { useSettings } from "../store/useSettings";
import { useUI } from "../store/useUI";
import { computePlanStats } from "../lib/derive";
import { formatJalaliLong, formatJalaliShort, relativeLabel, todayISO } from "../lib/jalali";
import { formatToman } from "../lib/money";
import { toFaDigits } from "../lib/digits";
import { statusOf, isPaid, remaining } from "../lib/status";
import { quickPay } from "../lib/actions";
import { DIRECTION_LABEL } from "../lib/constants";
import type { Installment } from "../lib/types";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/Dialog";
import { PlanIcon } from "../components/ui/PlanIcon";
import { EmptyState } from "../components/ui/Misc";
import { EditInstallmentDialog, PayDialog } from "../components/InstallmentDialogs";
import { cn } from "../lib/utils";

const menuItem =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] outline-none data-[highlighted]:bg-surface-2";

export function PlanDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { plans, installments, setArchived, deletePlan, undoPayment, setPayment } = usePlans();
  const reminderDays = useSettings((s) => s.reminderDays);
  const openWizard = useUI((s) => s.openWizard);
  const celebrate = useUI((s) => s.celebrate);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [payFor, setPayFor] = useState<Installment | null>(null);
  const [editFor, setEditFor] = useState<Installment | null>(null);
  const [delOpen, setDelOpen] = useState(false);

  const plan = plans.find((p) => p.id === Number(id));
  const today = todayISO();
  const s = useMemo(() => (plan ? computePlanStats(plan, installments, today) : null), [plan, installments, today]);

  if (!plan || !s) {
    return (
      <div className="rounded-3xl border border-dashed border-line bg-surface/60">
        <EmptyState icon={<Wallet size={38} />} title="این قسط پیدا نشد" description="ممکن است حذف شده باشد." action={{ label: "بازگشت به اقساط", onClick: () => nav("/plans") }} />
      </div>
    );
  }

  const toggle = (iid: number) =>
    setSel((x) => {
      const n = new Set(x);
      n.has(iid) ? n.delete(iid) : n.add(iid);
      return n;
    });
  const unpaidIds = s.items.filter((i) => !isPaid(i)).map((i) => i.id);
  const allSelected = unpaidIds.length > 0 && unpaidIds.every((x) => sel.has(x));

  const bulkPay = async () => {
    const ids = [...sel].filter((x) => unpaidIds.includes(x));
    let finished = false;
    for (const iid of ids) {
      const inst = s.items.find((i) => i.id === iid)!;
      const r = await setPayment(iid, inst.amount, today);
      finished = r.planFinished;
    }
    setSel(new Set());
    toast.success(`${toFaDigits(ids.length)} قسط پرداخت شد`);
    if (finished) celebrate(true);
  };

  const totalPayable = s.installmentsSum + plan.down_payment;
  const receivable = plan.direction === "receivable";

  return (
    <div>
      <Link to="/plans" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-fg">
        <ArrowRight size={15} /> بازگشت به اقساط
      </Link>

      {/* Header */}
      <Card className="relative mb-5 overflow-hidden p-6">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: plan.color }} />
        <div className="flex items-start gap-4">
          <PlanIcon icon={plan.icon} color={plan.color} size={60} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-extrabold tracking-tight">{plan.title}</h1>
              <Badge tone={receivable ? "info" : "neutral"}>{DIRECTION_LABEL[plan.direction]}</Badge>
              {plan.category && <Badge>{plan.category}</Badge>}
              {plan.archived ? <Badge>بایگانی</Badge> : null}
              {s.finished && <Badge tone="accent"><Check size={12} /> تسویه شده</Badge>}
            </div>
            <div className="mt-1 text-[13.5px] text-muted">
              {plan.counterparty || "—"} · {plan.interval_value > 1 ? `هر ${toFaDigits(plan.interval_value)} ` : "هر "}
              {plan.interval_type === "monthly" ? "ماه" : plan.interval_type === "weekly" ? "هفته" : "روز"}
              {plan.profit_rate > 0 && <> · سود {toFaDigits(plan.profit_rate)}٪ سالانه</>}
            </div>
            {plan.notes && (
              <div className="selectable mt-2 flex items-start gap-1.5 text-[13px] text-muted">
                <StickyNote size={14} className="mt-1 shrink-0" /> {plan.notes}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => openWizard(plan.id)}>
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
                      await setArchived(plan.id, !plan.archived);
                      toast.success(plan.archived ? "از بایگانی خارج شد" : "بایگانی شد");
                    }}
                  >
                    {plan.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    {plan.archived ? "خارج کردن از بایگانی" : "بایگانی"}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Item className={cn(menuItem, "text-danger-ink")} onSelect={() => setDelOpen(true)}>
                    <Trash2 size={16} /> حذف قسط
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-4">
          <Mini label="مجموع قابل پرداخت" value={formatToman(totalPayable)} sub={plan.down_payment ? `شامل پیش‌پرداخت ${formatToman(plan.down_payment)}` : undefined} />
          <Mini label="پرداخت‌شده" value={formatToman(s.paidSum)} tone="accent" />
          <Mini label="باقی‌مانده" value={formatToman(s.remainingSum)} tone={s.overdueCount ? "danger" : undefined} sub={s.overdueCount ? `${toFaDigits(s.overdueCount)} قسط معوق` : undefined} />
          <Mini
            label="قسط بعدی"
            value={s.next ? formatJalaliShort(s.next.due_date) : "—"}
            sub={s.next ? `${relativeLabel(s.next.due_date)} · ${formatToman(remaining(s.next))}` : "همه اقساط پرداخت شده"}
          />
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span className="num">{toFaDigits(s.paidCount)} از {toFaDigits(s.total)} قسط</span>
            <span className="font-bold text-fg num">{toFaDigits(s.percent)}٪</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(270deg, ${plan.color}, color-mix(in srgb, ${plan.color} 60%, white))` }}
              initial={{ width: 0 }}
              animate={{ width: `${s.percent}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </Card>

      {/* Installments */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-bold">جدول اقساط</h2>
          <div className="flex items-center gap-2">
            {sel.size > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Button variant="primary" size="sm" onClick={() => void bulkPay()}>
                  <CheckCheck size={15} /> پرداخت {toFaDigits(sel.size)} قسط انتخاب‌شده
                </Button>
              </motion.div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13.5px]">
            <thead className="bg-surface-2/60 text-xs text-muted">
              <tr>
                <th className="w-12 px-4 py-2.5">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-emerald-600"
                    checked={allSelected}
                    disabled={unpaidIds.length === 0}
                    onChange={() => setSel(allSelected ? new Set() : new Set(unpaidIds))}
                    aria-label="انتخاب همه"
                  />
                </th>
                <th className="px-3 py-2.5 text-start font-medium">#</th>
                <th className="px-3 py-2.5 text-start font-medium">سررسید</th>
                <th className="px-3 py-2.5 text-start font-medium">مبلغ</th>
                <th className="px-3 py-2.5 text-start font-medium">پرداخت‌شده</th>
                <th className="px-3 py-2.5 text-start font-medium">وضعیت</th>
                <th className="w-44 px-3 py-2.5 text-start font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((i, idx) => {
                const st = statusOf(i, today, reminderDays);
                const paid = isPaid(i);
                return (
                  <motion.tr
                    key={i.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx, 14) * 0.02 }}
                    className={cn("border-t border-line transition-colors hover:bg-surface-2/50", sel.has(i.id) && "bg-accent-soft/40", paid && "text-muted")}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-emerald-600"
                        disabled={paid}
                        checked={sel.has(i.id)}
                        onChange={() => toggle(i.id)}
                        aria-label={`انتخاب قسط ${toFaDigits(i.seq)}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium num">{toFaDigits(i.seq)}</td>
                    <td className="px-3 py-2.5">
                      <div className="num">{formatJalaliLong(i.due_date)}</div>
                      {!paid && <div className={cn("text-xs", st === "overdue" ? "text-danger-ink" : "text-muted")}>{relativeLabel(i.due_date, today)}</div>}
                    </td>
                    <td className="px-3 py-2.5 font-semibold num">
                      {formatToman(i.amount)}
                      {i.note && <StickyNote size={13} className="ms-1.5 inline text-muted" aria-label={i.note} />}
                    </td>
                    <td className="px-3 py-2.5 num">
                      {i.paid_amount > 0 ? (
                        <>
                          <div>{formatToman(i.paid_amount)}</div>
                          {i.paid_date && <div className="text-xs text-muted">{formatJalaliShort(i.paid_date)}</div>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={st} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {!paid && (
                          <Button size="sm" variant="soft" onClick={() => void quickPay(i.id)}>
                            <Check size={14} /> پرداخت شد
                          </Button>
                        )}
                        {!paid && (
                          <Button size="icon" variant="ghost" className="size-8" aria-label="ثبت پرداخت جزئی" title="ثبت پرداخت (جزئی)" onClick={() => setPayFor(i)}>
                            <Wallet size={16} />
                          </Button>
                        )}
                        {i.paid_amount > 0 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="بازگردانی پرداخت"
                            title="بازگردانی پرداخت"
                            onClick={async () => {
                              await undoPayment(i.id);
                              toast("پرداخت بازگردانده شد");
                            }}
                          >
                            <Undo2 size={16} />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="size-8" aria-label="ویرایش" title="ویرایش مبلغ/تاریخ/یادداشت" onClick={() => setEditFor(i)}>
                          <Pencil size={15} />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <PayDialog inst={payFor} onClose={() => setPayFor(null)} />
      <EditInstallmentDialog inst={editFor} onClose={() => setEditFor(null)} />
      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        danger
        title="حذف این قسط؟"
        description={`«${plan.title}» و همه ${toFaDigits(s.total)} قسط و پرداخت‌های آن برای همیشه حذف می‌شود. این کار قابل بازگشت نیست.`}
        confirmLabel="حذف دائمی"
        onConfirm={async () => {
          await deletePlan(plan.id);
          toast.success("قسط حذف شد");
          nav("/plans");
        }}
      />
    </div>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "accent" | "danger" }) {
  return (
    <div className="rounded-2xl bg-surface-2/60 p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("mt-1 text-[16px] font-extrabold num", tone === "accent" && "text-accent-ink", tone === "danger" && "text-danger-ink")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted num">{sub}</div>}
    </div>
  );
}
