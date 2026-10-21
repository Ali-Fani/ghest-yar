import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { STATUS_LABEL, type InstallmentStatus } from "../../lib/status";

type Tone = "neutral" | "accent" | "danger" | "warn" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent-ink",
  danger: "bg-danger-soft text-danger-ink",
  warn: "bg-warn-soft text-warn-ink",
  info: "bg-info-soft text-info-ink",
};

export function Badge({ tone = "neutral", className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...p}
    />
  );
}

const statusTone: Record<InstallmentStatus, Tone> = { paid: "accent", partial: "info", overdue: "danger", "due-soon": "warn", upcoming: "neutral" };

export function StatusBadge({ status }: { status: InstallmentStatus }) {
  return (
    <Badge tone={statusTone[status]}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}
