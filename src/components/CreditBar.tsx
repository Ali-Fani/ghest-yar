import { motion } from "motion/react";
import { toFaDigits } from "../lib/digits";
import { formatUsage, type CreditUsage } from "../lib/creditUsage";
import { cn } from "../lib/utils";

const FILL = { ok: "bg-accent", warn: "bg-warn", danger: "bg-danger" } as const;
const INK = { ok: "text-muted", warn: "text-warn-ink", danger: "text-danger-ink" } as const;

/** «۶٫۲ از ۱۰ میلیون» with a bar: amber from 80%, rose from 100%. */
export function CreditBar({ usage, className }: { usage: CreditUsage; className?: string }) {
  if (!usage.limit) {
    return <div className={cn("whitespace-nowrap text-xs text-muted", className)}>سقف اعتبار تعریف نشده</div>;
  }
  const pct = Math.min(100, usage.percent);
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2 whitespace-nowrap text-xs">
        <span className="truncate text-muted">اعتبار استفاده‌شده</span>
        <span className={cn("shrink-0 font-semibold num", INK[usage.tone])}>
          {formatUsage(usage.used, usage.limit)} · {toFaDigits(Math.round(usage.percent))}٪
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(usage.percent)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className={cn("h-full rounded-full", FILL[usage.tone])} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
      </div>
    </div>
  );
}
