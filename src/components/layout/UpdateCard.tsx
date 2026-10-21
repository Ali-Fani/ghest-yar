import { AnimatePresence, motion } from "motion/react";
import { Download, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "../ui/Button";
import { MiniMarkdown } from "../ui/MiniMarkdown";
import { faVersion } from "../../lib/version";
import { toFaDigits } from "../../lib/digits";
import { formatMB, useUpdater } from "../../lib/updater";

/** Non-blocking card shown when an update is available / downloading. */
export function UpdateCard() {
  const { status, version, notes, downloaded, total, error, dismissed, install, dismiss } = useUpdater();
  const busy = status === "downloading" || status === "installing";
  const show = (status === "available" && !dismissed) || busy || (status === "error" && !dismissed && !!version);
  const pct = total ? Math.min(100, Math.round((downloaded / total) * 100)) : null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="glass fixed bottom-5 start-5 z-50 w-[380px] rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-lg)]"
          role="status"
          dir="rtl"
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
              {status === "error" ? <TriangleAlert size={20} /> : <Sparkles size={20} />}
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-extrabold">
                {status === "error" ? "به‌روزرسانی ناموفق بود" : `نسخهٔ جدید ${faVersion(version ?? "")} آماده است`}
              </div>
              <div className="text-[12px] text-muted">
                {status === "downloading" && "در حال دریافت به‌روزرسانی…"}
                {status === "installing" && "در حال نصب و راه‌اندازی مجدد…"}
                {status === "available" && "قسط‌یار می‌تواند خودش را به‌روز کند"}
                {status === "error" && error}
              </div>
            </div>
          </div>

          {status === "available" && notes.trim() && (
            <div className="mb-4 max-h-44 overflow-y-auto rounded-xl bg-surface-2 px-3.5 py-2.5">
              <MiniMarkdown source={notes} />
            </div>
          )}

          {busy && (
            <div className="mb-1">
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className={`h-full rounded-full bg-accent-strong ${pct === null ? "animate-pulse" : ""}`}
                  animate={{ width: pct === null ? "35%" : `${pct}%` }}
                  transition={{ ease: "easeOut", duration: 0.25 }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-muted num">
                <span>{total ? `${formatMB(downloaded)} از ${formatMB(total)}` : formatMB(downloaded)}</span>
                <span className="font-bold text-fg">{pct !== null ? `${toFaDigits(pct)}٪` : ""}</span>
              </div>
            </div>
          )}

          {status === "available" && (
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => void install()}>
                <Download size={16} /> نصب و راه‌اندازی مجدد
              </Button>
              <Button variant="ghost" onClick={dismiss}>
                بعداً
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => void install()}>
                <RefreshCw size={16} /> تلاش دوباره
              </Button>
              <Button variant="ghost" onClick={dismiss}>
                بستن
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
