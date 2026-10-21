import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { normalizeDigits, toFaDigits } from "../../lib/digits";

export const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3.5 h-10 text-[14.5px] text-fg placeholder:text-muted/70 transition-colors outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputCls, className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(inputCls, "h-auto min-h-[84px] resize-none py-2.5 leading-7", className)} {...p} />;
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <label className="text-[13px] font-medium text-muted">{label}</label>}
      {children}
      {error ? <p className="text-xs text-danger-ink">{error}</p> : hint ? <p className="min-h-4 text-xs text-accent-ink">{hint}</p> : null}
    </div>
  );
}

/** Text input that shows Persian digits and accepts any digit script. Value is a string of Latin chars. */
export function NumInput({
  value,
  onChange,
  decimal,
  className,
  suffix,
  ...p
}: {
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  suffix?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = useId();
  return (
    <div className="relative">
      <input
        id={id}
        inputMode={decimal ? "decimal" : "numeric"}
        dir="ltr"
        className={cn(inputCls, "text-start num", suffix && "pe-14", className)}
        style={{ direction: "rtl", textAlign: "right" }}
        value={toFaDigits(value)}
        onChange={(e) => {
          let v = normalizeDigits(e.target.value);
          v = decimal ? v.replace(/[^0-9.]/g, "") : v.replace(/[^0-9]/g, "");
          onChange(v);
        }}
        {...p}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted">{suffix}</span>}
    </div>
  );
}
