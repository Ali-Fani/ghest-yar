import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Toaster } from "sonner";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { UpdateCard } from "./UpdateCard";
import { PlanWizard } from "../../pages/PlanWizard";
import { Celebration } from "../ui/Confetti";
import { useUI } from "../../store/useUI";
import { useSettings } from "../../store/useSettings";

export function Shell() {
  const loc = useLocation();
  const openWizard = useUI((s) => s.openWizard);
  const setPalette = useUI((s) => s.setPalette);
  const celebrating = useUI((s) => s.celebrating);
  const celebrate = useUI((s) => s.celebrate);
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        openWizard();
      } else if (k === "k") {
        e.preventDefault();
        setPalette(!useUI.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openWizard, setPalette]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => document.documentElement.classList.toggle("dark", mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [theme]);

  return (
    <div className="app-backdrop flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={loc.pathname.split("/")[1] + (loc.pathname.split("/")[2] ?? "")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="mx-auto w-full max-w-[1600px] px-8 py-7"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <UpdateCard />
      <PlanWizard />
      <CommandPalette />
      <Celebration show={celebrating} onDone={() => celebrate(false)} />
      <Toaster position="bottom-left" dir="rtl" theme={theme === "system" ? "system" : theme} toastOptions={{ className: "font-sans" }} />
    </div>
  );
}
