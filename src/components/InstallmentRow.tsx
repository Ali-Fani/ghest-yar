import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import type { Installment, Plan } from "../lib/types";
import { formatJalaliMedium, relativeLabel } from "../lib/jalali";
import { formatToman } from "../lib/money";
import { toFaDigits } from "../lib/digits";
import { isPaid, remaining } from "../lib/status";
import { quickPay } from "../lib/actions";
import { PlanIcon } from "./ui/PlanIcon";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

export function InstallmentRow({ inst, plan, today, showDate = true }: { inst: Installment; plan: Plan; today: string; showDate?: boolean }) {
  const paid = isPaid(inst);
  const overdue = !paid && inst.due_date < today;
  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2/70">
      <PlanIcon icon={plan.icon} color={plan.color} size={38} />
      <Link to={`/plans/${plan.id}`} className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{plan.title}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="num">قسط {toFaDigits(inst.seq)}</span>
          {showDate && (
            <>
              <span>·</span>
              <span className="num">{formatJalaliMedium(inst.due_date)}</span>
              <span className={cn(overdue && "font-medium text-danger-ink")}>({relativeLabel(inst.due_date, today)})</span>
            </>
          )}
        </div>
      </Link>
      <div className="text-end">
        <div className={cn("text-[14px] font-bold num", paid && "text-muted line-through")}>{formatToman(paid ? inst.amount : remaining(inst))}</div>
      </div>
      {!paid ? (
        <Button size="sm" variant="soft" className="opacity-80 transition-opacity group-hover:opacity-100" onClick={() => void quickPay(inst.id)}>
          <Check size={14} /> پرداخت شد
        </Button>
      ) : (
        <span className="flex w-[100px] justify-center text-accent-ink">
          <Check size={18} />
        </span>
      )}
    </div>
  );
}
