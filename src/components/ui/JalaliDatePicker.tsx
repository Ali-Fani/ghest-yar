import { Popover } from "radix-ui";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { toFaDigits } from "../../lib/digits";
import {
  WEEK_HEADERS_SHORT,
  formatJalaliLong,
  formatMonthYear,
  monthGrid,
  shiftMonth,
  toJalali,
  todayISO,
} from "../../lib/jalali";
import { inputCls } from "./Input";

export function JalaliDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  className,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const init = toJalali(value ?? today);
  const [view, setView] = useState({ y: init.y, m: init.m });

  useEffect(() => {
    if (open) {
      const j = toJalali(value ?? todayISO());
      setView({ y: j.y, m: j.m });
    }
  }, [open, value]);

  const cells = monthGrid(view.y, view.m);
  const nav = (d: number) => setView((v) => shiftMonth(v.y, v.m, d));

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={cn(inputCls, "flex cursor-pointer items-center justify-between gap-2 text-start", className)}>
          <span className={cn("truncate num", !value && "text-muted/70")}>{value ? formatJalaliLong(value) : placeholder}</span>
          <CalendarDays size={17} className="shrink-0 text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          dir="rtl"
          sideOffset={8}
          align="start"
          collisionPadding={12}
          className="pop-anim z-[90] w-[304px] rounded-2xl border border-line bg-surface p-3 shadow-pop outline-none"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex">
              <NavBtn onClick={() => nav(-12)} label="سال قبل">
                <ChevronsRight size={16} />
              </NavBtn>
              <NavBtn onClick={() => nav(-1)} label="ماه قبل">
                <ChevronRight size={16} />
              </NavBtn>
            </div>
            <div className="text-sm font-bold">{formatMonthYear(view.y, view.m)}</div>
            <div className="flex">
              <NavBtn onClick={() => nav(1)} label="ماه بعد">
                <ChevronLeft size={16} />
              </NavBtn>
              <NavBtn onClick={() => nav(12)} label="سال بعد">
                <ChevronsLeft size={16} />
              </NavBtn>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEK_HEADERS_SHORT.map((w, i) => (
              <div key={w} className={cn("py-1 text-xs font-medium text-muted", i === 6 && "text-danger-ink")}>
                {w}
              </div>
            ))}
            {cells.map((c, idx) => {
              const selected = c.iso === value;
              const isToday = c.iso === today;
              const friday = idx % 7 === 6;
              return (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => {
                    onChange(c.iso);
                    setOpen(false);
                  }}
                  className={cn(
                    "mx-auto flex size-9 cursor-pointer items-center justify-center rounded-xl text-[13px] num transition-colors",
                    !c.inMonth && "opacity-30",
                    friday && !selected && "text-danger-ink",
                    !selected && "hover:bg-surface-2",
                    isToday && !selected && "ring-1 ring-accent",
                    selected && "bg-accent-strong font-bold text-white shadow-[0_4px_12px_-4px] shadow-accent-strong",
                  )}
                >
                  {toFaDigits(c.jd.d)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2">
            <button
              type="button"
              className="cursor-pointer rounded-lg px-2 py-1 text-[13px] font-medium text-accent-ink hover:bg-accent-soft"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
            >
              امروز
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NavBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  );
}
