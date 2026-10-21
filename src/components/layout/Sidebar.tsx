import { NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarDays, ChevronsLeft, ChevronsRight, LayoutDashboard, ListChecks, Monitor, Moon, Plus, Settings, Sun, BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { toFaDigits } from "../../lib/digits";
import { todayISO } from "../../lib/jalali";
import { isOverdue } from "../../lib/status";
import { usePlans } from "../../store/usePlans";
import { useSettings, type Theme } from "../../store/useSettings";
import { useUI } from "../../store/useUI";
import { Tip } from "../ui/Misc";
import { Logo } from "./Logo";

const NAV = [
  { to: "/", label: "داشبورد", icon: LayoutDashboard, end: true },
  { to: "/plans", label: "اقساط من", icon: ListChecks, badge: true },
  { to: "/calendar", label: "تقویم", icon: CalendarDays },
  { to: "/reports", label: "گزارش‌ها", icon: BarChart3 },
  { to: "/settings", label: "تنظیمات", icon: Settings },
];

const THEME_NEXT: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
const THEME_LABEL: Record<Theme, string> = { light: "تم روشن", dark: "تم تیره", system: "تم سیستم" };

export function Sidebar() {
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const theme = useSettings((s) => s.theme);
  const setSetting = useSettings((s) => s.set);
  const openWizard = useUI((s) => s.openWizard);
  const installments = usePlans((s) => s.installments);
  const plans = usePlans((s) => s.plans);
  const loc = useLocation();

  const overdue = useMemo(() => {
    const today = todayISO();
    const active = new Set(plans.filter((p) => !p.archived && p.direction === "payable").map((p) => p.id));
    return installments.filter((i) => active.has(i.plan_id) && isOverdue(i, today)).length;
  }, [installments, plans]);

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 244 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      className="glass relative z-30 flex h-full shrink-0 flex-col border-e border-line/70 px-3 py-4"
    >
      <div className={cn("mb-6 flex items-center gap-3 px-1.5", collapsed && "justify-center")}>
        <Logo size={36} />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[17px] font-extrabold tracking-tight">قسط‌یار</div>
            <div className="text-[11px] text-muted">مدیریت هوشمند اقساط</div>
          </div>
        )}
      </div>

      <Tip label="قسط جدید (Ctrl+N)">
        <button
          type="button"
          onClick={() => openWizard()}
          className={cn(
            "mb-5 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent-strong font-semibold text-white shadow-[0_8px_20px_-8px] shadow-accent-strong transition-all hover:brightness-110 active:scale-[0.97]",
            collapsed ? "w-full" : "w-full",
          )}
        >
          <Plus size={19} strokeWidth={2.6} />
          {!collapsed && <span>قسط جدید</span>}
        </button>
      </Tip>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((n) => {
          const active = n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
          const item = (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
                collapsed && "justify-center px-0",
                active ? "text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-accent-soft"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                <n.icon size={19} strokeWidth={active ? 2.4 : 2} />
                {!collapsed && n.label}
              </span>
              {n.badge && overdue > 0 && (
                <span
                  className={cn(
                    "relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white num",
                    collapsed ? "absolute end-1.5 top-1.5 h-4 min-w-4 px-1 text-[10px]" : "ms-auto",
                  )}
                >
                  {toFaDigits(overdue)}
                </span>
              )}
            </NavLink>
          );
          return collapsed ? (
            <Tip key={n.to} label={n.label}>
              {item}
            </Tip>
          ) : (
            item
          );
        })}
      </nav>

      <div className={cn("mt-3 flex gap-1 border-t border-line/70 pt-3", collapsed ? "flex-col items-center" : "items-center justify-between")}>
        <Tip label={`${THEME_LABEL[theme]} - تغییر تم`}>
          <button
            type="button"
            onClick={() => void setSetting("theme", THEME_NEXT[theme])}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ThemeIcon size={17} />
            {!collapsed && THEME_LABEL[theme]}
          </button>
        </Tip>
        <Tip label={collapsed ? "باز کردن منو" : "جمع کردن منو"}>
          <button
            type="button"
            onClick={() => void setSetting("sidebarCollapsed", !collapsed)}
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label="جمع کردن منو"
          >
            {collapsed ? <ChevronsRight size={17} className="rotate-180" /> : <ChevronsLeft size={17} className="rotate-180" />}
          </button>
        </Tip>
      </div>
    </motion.aside>
  );
}
