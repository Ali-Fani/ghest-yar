import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Hourglass } from "lucide-react";
import { formatJalaliMedium, relativeLabel } from "../lib/jalali";
import { formatToman, formatTomanCompact } from "../lib/money";
import { toFaDigits } from "../lib/digits";
import { dueHref, quickPayDue } from "../lib/actions";
import { isDueOverdue, type DueGroup, type DueItem } from "../lib/dueItems";
import { PlanIcon } from "./ui/PlanIcon";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/utils";

/**
 * One due thing: an installment or a provider statement. Everything stays on one line:
 * the title truncates, amounts and buttons never shrink or wrap.
 */
export function DueRow({
  item,
  today,
  showDate = true,
  showProvider = true,
  className,
}: {
  item: DueItem;
  today: string;
  showDate?: boolean;
  showProvider?: boolean;
  className?: string;
}) {
  const paid = item.paid;
  const overdue = isDueOverdue(item, today);
  const statement = item.kind === "statement";
  return (
    <div className={cn("group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2/70", className)}>
      <PlanIcon icon={statement ? "receipt" : item.icon} color={item.color} size={38} />
      <Link to={dueHref(item)} className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{item.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted">
          {statement ? (
            <Badge tone={item.open ? "info" : "warn"} className="shrink-0 px-2 py-0 text-[11px]">
              صورتحساب
            </Badge>
          ) : (
            <span className="shrink-0 num">قسط {toFaDigits(item.seq ?? 0)}</span>
          )}
          {!statement && showProvider && item.providerName && (
            <>
              <span className="shrink-0">·</span>
              <span className="truncate">{item.providerName}</span>
            </>
          )}
          {showDate && (
            <>
              <span className="shrink-0">·</span>
              <span className="truncate num">{formatJalaliMedium(item.dueDate)}</span>
            </>
          )}
        </div>
      </Link>
      <div className="shrink-0 whitespace-nowrap text-end">
        <div className={cn("text-[14px] font-bold num", paid && "text-muted line-through")}>{formatToman(paid ? item.amount : item.remaining)}</div>
        {showDate && !paid && (
          <div className={cn("mt-0.5 text-[11.5px] text-muted num", overdue && "font-medium text-danger-ink")}>{relativeLabel(item.dueDate, today)}</div>
        )}
      </div>
      <PayCell item={item} showDate={showDate} />
    </div>
  );
}

function PayCell({ item, showDate }: { item: DueItem; showDate: boolean }) {
  if (item.paid) {
    return (
      <span className={cn("flex shrink-0 justify-center text-accent-ink", showDate ? "w-[100px]" : "w-9")}>
        <Check size={18} />
      </span>
    );
  }
  if (item.open) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-xs text-muted", showDate ? "w-[100px]" : "w-9")} title="چرخه هنوز بسته نشده است">
        <Hourglass size={14} /> {showDate && "در جریان"}
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="soft"
      className={cn("shrink-0 whitespace-nowrap opacity-80 transition-opacity group-hover:opacity-100", !showDate && "px-2.5")}
      title="پرداخت شد"
      onClick={() => void quickPayDue(item)}
    >
      <Check size={14} /> {showDate && "پرداخت شد"}
    </Button>
  );
}

/** «۳ قسط اسنپ‌پی — ۴٫۲ میلیون»: same-day installments of one provider in a single expandable row. */
export function DueGroupRow({ group, today, providerName }: { group: DueGroup; today: string; providerName: string }) {
  const [open, setOpen] = useState(false);
  if (group.items.length === 1) return <DueRow item={group.items[0]} today={today} />;
  const first = group.items[0];
  const overdue = group.items.some((i) => isDueOverdue(i, today));
  return (
    <div className="rounded-xl transition-colors hover:bg-surface-2/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-start"
      >
        <PlanIcon icon={first.icon} color={first.color} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold">
            <span className="num">{toFaDigits(group.items.length)}</span> قسط {providerName}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted">
            <span className="truncate num">{formatJalaliMedium(group.dueDate)}</span>
          </div>
        </div>
        <div className="shrink-0 whitespace-nowrap text-end">
          <div className="text-[14px] font-bold num">{formatTomanCompact(group.total)} تومان</div>
          <div className={cn("mt-0.5 text-[11.5px] text-muted num", overdue && "font-medium text-danger-ink")}>{relativeLabel(group.dueDate, today)}</div>
        </div>
        <span className="flex w-[100px] shrink-0 justify-center text-muted">
          <ChevronDown size={18} className={cn("transition-transform", open && "rotate-180")} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="ms-6 border-s-2 border-line ps-2 pb-1">
              {group.items.map((i) => (
                <DueRow key={i.key} item={i} today={today} showProvider={false} showDate={false} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
