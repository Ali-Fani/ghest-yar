import { motion, AnimatePresence } from "motion/react";
import { Check } from "lucide-react";
import { useEffect, useMemo } from "react";

const COLORS = ["#10b981", "#34d399", "#f59e0b", "#0ea5e9", "#f43f5e", "#a855f7"];

/** Confetti-lite: a checkmark burst with a few falling pieces. Auto-dismisses. */
export function Celebration({ show, onDone, message = "این قسط کاملاً تسویه شد!" }: { show: boolean; onDone: () => void; message?: string }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 120 + Math.random() * 180;
        return {
          id: i,
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist + 80,
          rot: (Math.random() - 0.5) * 720,
          color: COLORS[i % COLORS.length],
          w: 6 + Math.random() * 6,
          h: 8 + Math.random() * 8,
          delay: Math.random() * 0.12,
        };
      }),
    [show],
  );
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [show, onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="relative flex flex-col items-center gap-3">
            {pieces.map((p) => (
              <span
                key={p.id}
                className="absolute start-1/2 top-1/2 rounded-[2px]"
                style={
                  {
                    width: p.w,
                    height: p.h,
                    background: p.color,
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                    "--rot": `${p.rot}deg`,
                    animation: `confetti-fall 1.4s cubic-bezier(.2,.7,.3,1) ${p.delay}s forwards`,
                  } as React.CSSProperties
                }
              />
            ))}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 16 }}
              className="flex size-24 items-center justify-center rounded-full bg-accent-strong text-white shadow-[0_16px_50px_-8px] shadow-accent-strong"
            >
              <Check size={52} strokeWidth={3.2} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-full border border-line bg-surface px-5 py-2 text-sm font-bold shadow-pop"
            >
              {message}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
