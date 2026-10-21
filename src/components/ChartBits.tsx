import { formatTomanCompact } from "../lib/money";

/** Y-axis tick for charts placed on the right (RTL): keeps "۱۰ میلیون" in natural Persian order. */
export function YTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  const v = payload?.value ?? 0;
  return (
    <text
      x={(x ?? 0) + 6}
      y={y}
      dy={4}
      textAnchor="end"
      fill="var(--muted)"
      fontSize={10.5}
      style={{ direction: "rtl", fontFamily: "inherit" }}
    >
      {v ? formatTomanCompact(v) : "۰"}
    </text>
  );
}

export const xTick = { fill: "var(--muted)", fontSize: 10.5, fontFamily: "inherit" } as const;
