import { Switch as RSwitch, Tooltip as RTooltip } from "radix-ui";
import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

export function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      dir="rtl"
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-line outline-none transition-colors data-[state=checked]:bg-accent-strong"
    >
      <RSwitch.Thumb className="absolute start-0.5 top-0.5 block size-5 rounded-full bg-white shadow transition-transform duration-200 data-[state=checked]:-translate-x-5" />
    </RSwitch.Root>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("inline-flex rounded-xl bg-surface-2 p-1", className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 cursor-pointer whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg bg-surface shadow-soft"
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RTooltip.Root delayDuration={250}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          sideOffset={6}
          className="pop-anim z-[80] rounded-lg bg-fg px-2.5 py-1 text-xs text-bg shadow-pop"
        >
          {label}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center"
    >
      <div className="relative">
        <div className="absolute inset-0 -m-3 rounded-[28px] bg-accent/10 blur-xl" />
        <div className="relative flex size-20 items-center justify-center rounded-[26px] border border-line bg-gradient-to-br from-accent-soft to-surface text-accent-ink shadow-soft">
          {icon}
        </div>
      </div>
      <h3 className="mt-2 text-base font-bold">{title}</h3>
      {description && <p className="max-w-sm text-[13.5px] leading-7 text-muted">{description}</p>}
      {action && (
        <Button variant="primary" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13.5px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
