import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Field, Textarea } from "./ui/Input";
import { MoneyInput } from "./ui/MoneyInput";
import { JalaliDatePicker } from "./ui/JalaliDatePicker";
import { usePlans } from "../store/usePlans";
import { useUI } from "../store/useUI";
import { todayISO } from "../lib/jalali";
import { formatToman } from "../lib/money";
import { remaining } from "../lib/status";
import type { Installment } from "../lib/types";
import { toFaDigits } from "../lib/digits";

/** Register a full or partial payment with a Jalali payment date. */
export function PayDialog({ inst, onClose }: { inst: Installment | null; onClose: () => void }) {
  const setPayment = usePlans((s) => s.setPayment);
  const celebrate = useUI((s) => s.celebrate);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    if (inst) {
      setAmount(remaining(inst));
      setDate(todayISO());
    }
  }, [inst]);

  const rem = inst ? remaining(inst) : 0;
  const valid = amount > 0;

  const submit = async () => {
    if (!inst || !valid) return;
    const newPaid = Math.min(inst.amount, inst.paid_amount + amount);
    const { planFinished } = await setPayment(inst.id, newPaid, date);
    toast.success(newPaid >= inst.amount ? "قسط پرداخت شد" : "پرداخت جزئی ثبت شد");
    if (planFinished) celebrate(true);
    onClose();
  };

  return (
    <Modal open={!!inst} onOpenChange={(o) => !o && onClose()} title="ثبت پرداخت" description={inst ? `قسط شماره ${toFaDigits(inst.seq)} — مانده: ${formatToman(rem)}` : undefined}>
      <div className="flex flex-col gap-5 px-6 py-5">
        <Field label="مبلغ پرداختی">
          <MoneyInput value={amount} onChange={setAmount} chips={false} autoFocus />
          <div className="mt-1 flex gap-2">
            <button type="button" className="cursor-pointer rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent-ink" onClick={() => setAmount(rem)}>
              تمام مانده
            </button>
            <button type="button" className="cursor-pointer rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent-ink" onClick={() => setAmount(Math.floor(rem / 2 / 1000) * 1000)}>
              نصف مانده
            </button>
          </div>
        </Field>
        <Field label="تاریخ پرداخت">
          <JalaliDatePicker value={date} onChange={setDate} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>انصراف</Button>
          <Button variant="primary" disabled={!valid} onClick={() => void submit()}>ثبت پرداخت</Button>
        </div>
      </div>
    </Modal>
  );
}

export function EditInstallmentDialog({ inst, onClose }: { inst: Installment | null; onClose: () => void }) {
  const update = usePlans((s) => s.updateInstallment);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (inst) {
      setAmount(inst.amount);
      setDate(inst.due_date);
      setNote(inst.note ?? "");
    }
  }, [inst]);

  return (
    <Modal open={!!inst} onOpenChange={(o) => !o && onClose()} title="ویرایش قسط" description={inst ? `قسط شماره ${toFaDigits(inst.seq)}` : undefined}>
      <div className="flex flex-col gap-5 px-6 py-5">
        <Field label="مبلغ قسط">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="تاریخ سررسید">
          <JalaliDatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="یادداشت">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="توضیحات این قسط…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>انصراف</Button>
          <Button
            variant="primary"
            disabled={amount <= 0}
            onClick={async () => {
              if (!inst) return;
              await update(inst.id, { amount, due_date: date, note: note.trim() || null });
              toast.success("قسط ویرایش شد");
              onClose();
            }}
          >
            ذخیره
          </Button>
        </div>
      </div>
    </Modal>
  );
}
