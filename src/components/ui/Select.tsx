import { Select as RSelect } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { inputCls } from "./Input";

export interface Option {
  value: string;
  label: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange} dir="rtl">
      <RSelect.Trigger className={cn(inputCls, "flex cursor-pointer items-center justify-between gap-2 text-start", className)}>
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown size={16} className="text-muted" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          dir="rtl"
          className="pop-anim z-[70] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop"
        >
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-[14px] outline-none data-[highlighted]:bg-surface-2 data-[state=checked]:text-accent-ink"
              >
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                <RSelect.ItemIndicator>
                  <Check size={15} />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
