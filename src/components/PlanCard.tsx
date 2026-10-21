import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react";
import type { PlanStats } from "../lib/derive";
import { formatJalaliMedium, relativeLabel, todayISO } from "../lib/jalali";
import { formatToman } from "../lib/money";
import { toFaDigits } from "../lib/digits";
import { DIRECTION_LABEL, PLAN_KIND_LABEL } from "../lib/constants";
import type { Provider } from "../lib/types";
import { Badge } from "./ui/Badge";
import { PlanIcon } from "./ui/PlanIcon";
import { ProgressRing } from "./ui/ProgressRing";
import { cn } from "../lib/utils";

export function PlanCard({ s, index = 0, list, provider }: { s: PlanStats; index?: number; list?: boolean; provider?: Provider | null }) {
  const p = s.plan;
  const receivable = p.direction === "receivable";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.04, duration: 0.3, ease: "easeOut" }}
      layout="position"
    >
      <Link
        to={`/plans/${p.id}`}
        className={cn(
          "group relative block overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop",
          list && "flex items-center gap-5 py-4",
        )}
      >
        <div className="absolute inset-x-0 top-0 h-1 opacity-80" style={{ background: p.color }} />
        <div className={cn("flex items-start gap-3", list && "w-72 shrink-0 items-center")}>
          <PlanIcon icon={p.icon} color={p.color} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold">{p.title}</div>
            <div className="truncate text-[13px] text-muted">{p.store || p.counterparty || "—"}</div>
          </div>
          {!list && <ProgressRing percent={s.percent} color={s.finished ? "var(--accent)" : p.color} />}
        </div>

        <div className={cn("mt-3 flex flex-wrap gap-1.5", list && "mt-0 flex-1")}>
          <Badge tone={receivable ? "info" : "neutral"}>{DIRECTION_LABEL[p.direction]}</Badge>
          {p.kind !== "loan" && <Badge tone="info">{PLAN_KIND_LABEL[p.kind]}</Badge>}
          {provider && (
            <Badge className="max-w-[150px]" style={{ background: `color-mix(in srgb, ${provider.color} 15%, transparent)`, color: provider.color }}>
              <span className="size-1.5 shrink-0 rounded-full bg-current" />
              <span className="truncate">{provider.name}</span>
            </Badge>
          )}
          {p.category && !provider && <Badge>{p.category}</Badge>}
          {s.finished && (
            <Badge tone="accent">
              <CheckCircle2 size={12} /> تسویه شده
            </Badge>
          )}
          {p.archived ? <Badge>بایگانی</Badge> : null}
          {s.overdueCount > 0 && (
            <Badge tone="danger">
              <AlertTriangle size={12} /> {toFaDigits(s.overdueCount)} قسط معوق
            </Badge>
          )}
        </div>

        <div className={cn("mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3", list && "mt-0 w-[420px] shrink-0 border-t-0 pt-0")}>
          <div>
            <div className="text-xs text-muted">باقی‌مانده</div>
            <div className="text-[14px] font-bold num">{formatToman(s.remainingSum)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{s.next ? "قسط بعدی" : "وضعیت"}</div>
            {s.next ? (
              <div>
                <div className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium">
                  <CalendarClock size={14} className={s.next.due_date < todayISO() ? "text-danger" : "text-muted"} />
                  <span className="num">{formatJalaliMedium(s.next.due_date)}</span>
                </div>
                <div className={cn("text-xs", s.next.due_date < todayISO() ? "text-danger-ink" : "text-muted")}>{relativeLabel(s.next.due_date)}</div>
              </div>
            ) : (
              <div className="text-[13px] font-medium text-accent-ink">پایان یافته</div>
            )}
          </div>
        </div>
        <div className={cn("mt-2 text-xs text-muted num", list && "hidden")}>
          {toFaDigits(s.paidCount)} از {toFaDigits(s.total)} قسط پرداخت شده
        </div>
        {list && <ProgressRing percent={s.percent} color={p.color} size={48} />}
      </Link>
    </motion.div>
  );
}
