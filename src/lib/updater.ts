import { create } from "zustand";
import { isTauri } from "./db";
import { toFaDigits } from "./digits";
import { useSettings } from "../store/useSettings";

type Status = "idle" | "checking" | "uptodate" | "available" | "downloading" | "installing" | "error";

interface UpdaterState {
  status: Status;
  version: string | null;
  notes: string;
  downloaded: number;
  total: number | null;
  error: string | null;
  /** The user dismissed the card for this session ("بعداً"). */
  dismissed: boolean;
  check(opts?: { silent?: boolean }): Promise<void>;
  install(): Promise<void>;
  dismiss(): void;
}

// The Update handle from the plugin is not serializable; keep it outside the store.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pending: any = null;

/** Friendly Persian message for any updater failure (network errors are common). */
export function friendlyError(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e).toLowerCase();
  if (/(network|timed? ?out|dns|connect|resolve|unreachable|offline|error sending request|os error)/.test(m)) {
    return "اتصال به اینترنت برقرار نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.";
  }
  if (/(signature|verify|pubkey)/.test(m)) return "اعتبار فایل به‌روزرسانی تأیید نشد. لطفاً بعداً دوباره تلاش کنید.";
  if (/(404|not found|valid release json|status code)/.test(m)) return "اطلاعات به‌روزرسانی در دسترس نیست. کمی بعد دوباره تلاش کنید.";
  return "بررسی به‌روزرسانی انجام نشد. لطفاً بعداً دوباره تلاش کنید.";
}

export const useUpdater = create<UpdaterState>((set, get) => ({
  status: "idle",
  version: null,
  notes: "",
  downloaded: 0,
  total: null,
  error: null,
  dismissed: false,

  async check({ silent = false } = {}) {
    if (!isTauri()) return; // browser fallback: no-op
    const busy = get().status;
    if (busy === "checking" || busy === "downloading" || busy === "installing") return;
    if (!silent) set({ status: "checking", error: null });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check({ timeout: 20000 });
      if (update) {
        pending = update;
        // A silent re-check must not re-open a card the user already dismissed for this version.
        const same = get().version === update.version;
        set({ status: "available", version: update.version, notes: update.body ?? "", error: null, dismissed: silent && same ? get().dismissed : false });
      } else {
        pending = null;
        if (!silent) set({ status: "uptodate", version: null, notes: "" });
        else if (get().status === "checking") set({ status: "idle" });
      }
    } catch (e) {
      console.warn("update check failed", e);
      // Background checks fail quietly.
      if (!silent) set({ status: "error", error: friendlyError(e) });
      else if (get().status === "checking") set({ status: "idle" });
    }
  },

  async install() {
    if (!pending) return;
    set({ status: "downloading", downloaded: 0, total: null, error: null, dismissed: false });
    try {
      await pending.downloadAndInstall((ev: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => {
        if (ev.event === "Started") set({ total: ev.data?.contentLength ?? null, downloaded: 0 });
        else if (ev.event === "Progress") set((s) => ({ downloaded: s.downloaded + (ev.data?.chunkLength ?? 0) }));
        else if (ev.event === "Finished") set({ status: "installing" });
      });
      set({ status: "installing" });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      console.warn("update install failed", e);
      set({ status: "error", error: friendlyError(e), dismissed: false });
    }
  },

  dismiss: () => set({ dismissed: true }),
}));

/** bytes -> "۱٫۲ مگابایت" */
export function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${toFaDigits(mb.toFixed(1)).replace(".", "٫")} مگابایت`;
}

const FIRST_CHECK_MS = 5000;
const INTERVAL_MS = 6 * 60 * 60 * 1000;
let started = false;

/** Silent check ~5s after launch and then every 6 hours (respects the auto-update setting). */
export function startUpdateLoop() {
  if (started || !isTauri()) return;
  started = true;
  const run = () => {
    if (useSettings.getState().autoUpdate) void useUpdater.getState().check({ silent: true });
  };
  setTimeout(run, FIRST_CHECK_MS);
  setInterval(run, INTERVAL_MS);
}
