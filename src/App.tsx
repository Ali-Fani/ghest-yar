import { useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { Dashboard } from "./pages/Dashboard";
import { Plans } from "./pages/Plans";
import { PlanDetail } from "./pages/PlanDetail";
import { CalendarPage } from "./pages/Calendar";
import { Reports } from "./pages/Reports";
import { SettingsPage } from "./pages/Settings";
import { usePlans } from "./store/usePlans";
import { startReminderLoop } from "./lib/notify";
import { Logo } from "./components/layout/Logo";

export function App() {
  const loaded = usePlans((s) => s.loaded);
  const init = usePlans((s) => s.init);

  useEffect(() => {
    void init().then(() => startReminderLoop());
  }, [init]);

  // Block the native context menu / reload shortcuts in production feel.
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!import.meta.env.DEV && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.preventDefault();
    };
    window.addEventListener("contextmenu", h);
    return () => window.removeEventListener("contextmenu", h);
  }, []);

  if (!loaded) {
    return (
      <div className="app-backdrop flex h-full items-center justify-center">
        <div className="animate-pulse">
          <Logo size={64} />
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="plans" element={<Plans />} />
          <Route path="plans/:id" element={<PlanDetail />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
