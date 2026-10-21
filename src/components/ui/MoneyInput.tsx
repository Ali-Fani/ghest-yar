import { useState } from "react";
import { inputCls } from "./Input";
import { cn } from "../../lib/utils";
import { groupDigits } from "../../lib/money";
import { parseIntInput } from "../../lib/digits";
import { tomanInWords } from "../../lib/words";

const CHIPS = [
  { label: "+۱ میلیون", v: 1_000_000 },
  { label: "+۱۰ میلیون", v: 10_000_000 },
];

export function MoneyInput({
  value,
  onChange,
  placeholder = "۰",
  chips = true,
  showWords = true,
  className,
  autoFocus,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  chips?: boolean;
  showWords?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input
          inputMode="numeric"
          autoFocus={autoFocus}
          className={cn(inputCls, "pe-16 num font-medium", className)}
          placeholder={placeholder}
          value={value ? groupDigits(value) : ""}
          onChange={(e) => onChange(parseIntInput(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-y-0 end-3.5 flex items-center text-xs transition-colors",
            focused ? "text-accent-ink" : "text-muted",
          )}
        >
          تومان
        </span>
      </div>
      {chips && (
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => onChange(value + c.v)}
              className="cursor-pointer rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent-ink"
            >
              {c.label}
            </button>
          ))}
          {value > 0 && (
            <button
              type="button"
              onClick={() => onChange(0)}
              className="cursor-pointer rounded-full px-2 py-0.5 text-xs text-muted hover:text-danger-ink"
            >
              پاک کردن
            </button>
          )}
        </div>
      )}
      {showWords && <p className="min-h-5 text-xs leading-5 text-accent-ink">{tomanInWords(value)}</p>}
    </div>
  );
}
