import { Minus, Search, Square, Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isTauri } from "../../lib/db";
import { cn } from "../../lib/utils";
import { useUI } from "../../store/useUI";

type Win = {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onResized(cb: () => void): Promise<() => void>;
};

async function getWin(): Promise<Win | null> {
  if (!isTauri()) return null;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow() as unknown as Win;
}

function CtlButton({ onClick, children, danger, label }: { onClick: () => void; children: React.ReactNode; danger?: boolean; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-full w-12 cursor-pointer items-center justify-center text-muted transition-colors",
        danger ? "hover:bg-[#e81123] hover:text-white" : "hover:bg-fg/10 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar() {
  const [win, setWin] = useState<Win | null>(null);
  const [maxed, setMaxed] = useState(false);
  const setPalette = useUI((s) => s.setPalette);

  useEffect(() => {
    let un: (() => void) | undefined;
    void getWin().then(async (w) => {
      setWin(w);
      if (!w) return;
      setMaxed(await w.isMaximized());
      un = await w.onResized(async () => setMaxed(await w.isMaximized()));
    });
    return () => un?.();
  }, []);

  return (
    // Window controls always sit at the physical right on Windows, so this bar is forced LTR.
    <div
      dir="ltr"
      data-tauri-drag-region
      className="glass relative z-40 flex h-10 shrink-0 flex-row-reverse items-center justify-between border-b border-line/70"
    >
      <div className="flex h-full items-center" data-tauri-drag-region>
        {win && (
          <>
            <CtlButton label="کوچک کردن" onClick={() => void win.minimize()}>
              <Minus size={16} />
            </CtlButton>
            <CtlButton label={maxed ? "بازگردانی" : "بزرگ کردن"} onClick={() => void win.toggleMaximize()}>
              {maxed ? <Copy size={13} className="-scale-x-100" /> : <Square size={12} />}
            </CtlButton>
            <CtlButton label="بستن" danger onClick={() => void win.close()}>
              <X size={17} />
            </CtlButton>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => setPalette(true)}
        className="absolute start-1/2 top-1/2 flex h-7 w-72 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface/70 px-3 text-xs text-muted transition-colors hover:border-accent/60 hover:text-fg"
        dir="rtl"
      >
        <Search size={14} />
        <span className="flex-1 text-start">جستجو و دستورها…</span>
        <kbd className="rounded bg-surface-2 px-1.5 text-[10px]" dir="ltr">Ctrl K</kbd>
      </button>
      <div className="pointer-events-none flex items-center gap-2 px-4 text-[13px] font-bold text-muted" dir="rtl" data-tauri-drag-region>
        قسط‌یار
      </div>
    </div>
  );
}
