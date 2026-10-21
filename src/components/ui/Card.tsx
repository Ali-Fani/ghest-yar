import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { hover?: boolean }>(function Card(
  { className, hover, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-soft",
        hover && "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop",
        className,
      )}
      {...props}
    />
  );
});

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[15px] font-bold">{children}</h3>
      {action}
    </div>
  );
}
