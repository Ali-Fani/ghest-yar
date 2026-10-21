import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent-strong text-white shadow-[0_6px_16px_-6px] shadow-accent-strong/60 hover:brightness-110 active:brightness-95",
  secondary: "bg-surface text-fg border border-line hover:bg-surface-2 shadow-soft",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  soft: "bg-accent-soft text-accent-ink hover:brightness-95",
  danger: "bg-danger-soft text-danger-ink hover:brightness-95",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-10 px-4 rounded-xl gap-2",
  lg: "h-12 px-6 text-[15px] rounded-xl gap-2",
  icon: "h-9 w-9 rounded-lg justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap font-medium transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
