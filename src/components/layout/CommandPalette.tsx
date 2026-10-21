import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, LayoutDashboard, ListChecks, Moon, Plus, Search, Settings, Sun } from "lucide-react";
import { useUI } from "../../store/useUI";
import { usePlans } from "../../store/usePlans";
import { useSettings } from "../../store/useSettings";
import { PlanIcon } from "../ui/PlanIcon";
import { AnimatePresence, motion } from "motion/react";

const itemCls =
  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-fg transition-colors aria-selected:bg-accent-soft aria-selected:text-accent-ink";

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPalette);
  const openWizard = useUI((s) => s.openWizard);
  const plans = usePlans((s) => s.plans);
  const theme = useSettings((s) => s.theme);
  const setSetting = useSettings((s) => s.set);
  const nav = useNavigate();

  const go = (to: string) => {
    setOpen(false);
    nav(to);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 460, damping: 34 }}
                className="fixed inset-x-0 top-[14vh] z-[96] mx-auto w-[min(600px,92vw)] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-none"
              >
                <Dialog.Title className="sr-only">جستجو و دستورها</Dialog.Title>
                <Command loop label="جستجو" dir="rtl">
                  <div className="flex items-center gap-3 border-b border-line px-4">
                    <Search size={18} className="text-muted" />
                    <Command.Input
                      autoFocus
                      placeholder="جستجوی قسط، صفحه یا دستور…"
                      className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted/70"
                    />
                    <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
                  </div>
                  <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                    <Command.Empty className="py-10 text-center text-sm text-muted">نتیجه‌ای پیدا نشد</Command.Empty>
                    <Command.Group heading="دستورها" className="text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
                      <Command.Item className={itemCls} onSelect={() => { setOpen(false); openWizard(); }}>
                        <Plus size={17} /> قسط جدید <span className="ms-auto text-xs text-muted" dir="ltr">Ctrl N</span>
                      </Command.Item>
                      <Command.Item className={itemCls} onSelect={() => void setSetting("theme", theme === "dark" ? "light" : "dark")}>
                        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />} تغییر تم
                      </Command.Item>
                    </Command.Group>
                    <Command.Group heading="صفحه‌ها" className="text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
                      <Command.Item className={itemCls} onSelect={() => go("/")}><LayoutDashboard size={17} /> داشبورد</Command.Item>
                      <Command.Item className={itemCls} onSelect={() => go("/plans")}><ListChecks size={17} /> اقساط من</Command.Item>
                      <Command.Item className={itemCls} onSelect={() => go("/calendar")}><CalendarDays size={17} /> تقویم</Command.Item>
                      <Command.Item className={itemCls} onSelect={() => go("/reports")}><BarChart3 size={17} /> گزارش‌ها</Command.Item>
                      <Command.Item className={itemCls} onSelect={() => go("/settings")}><Settings size={17} /> تنظیمات</Command.Item>
                    </Command.Group>
                    {plans.length > 0 && (
                      <Command.Group heading="اقساط" className="text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
                        {plans.map((p) => (
                          <Command.Item
                            key={p.id}
                            value={`${p.title} ${p.counterparty ?? ""} ${p.category ?? ""} ${p.id}`}
                            className={itemCls}
                            onSelect={() => go(`/plans/${p.id}`)}
                          >
                            <PlanIcon icon={p.icon} color={p.color} size={28} />
                            <span>{p.title}</span>
                            {p.counterparty && <span className="text-xs text-muted">{p.counterparty}</span>}
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                  </Command.List>
                </Command>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
