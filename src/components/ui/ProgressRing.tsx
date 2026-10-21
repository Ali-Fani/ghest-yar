import { motion } from "motion/react";
import { toFaDigits } from "../../lib/digits";

export function ProgressRing({
  percent,
  size = 56,
  stroke = 6,
  color = "var(--accent)",
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(100, percent) / 100) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold num">
        {label ?? `${toFaDigits(percent)}٪`}
      </div>
    </div>
  );
}
