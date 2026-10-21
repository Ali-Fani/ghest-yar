import { create } from "zustand";
import { getRepo } from "../lib/db";

export type Theme = "light" | "dark" | "system";

export interface Settings {
  theme: Theme;
  reminderDays: number;
  notifications: boolean;
  launchCheck: boolean;
  autoUpdate: boolean;
  sidebarCollapsed: boolean;
}

const DEFAULTS: Settings = { theme: "system", reminderDays: 3, notifications: true, launchCheck: true, autoUpdate: true, sidebarCollapsed: false };

interface State extends Settings {
  raw: Record<string, string>;
  hydrate(raw: Record<string, string>): void;
  set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
  getRaw(key: string): string | undefined;
  setRaw(key: string, value: string): Promise<void>;
}

function parse(raw: Record<string, string>): Settings {
  const num = (k: string, d: number) => (raw[k] !== undefined && !isNaN(Number(raw[k])) ? Number(raw[k]) : d);
  const bool = (k: string, d: boolean) => (raw[k] === undefined ? d : raw[k] === "1");
  const theme = (raw.theme as Theme) ?? DEFAULTS.theme;
  return {
    theme: ["light", "dark", "system"].includes(theme) ? theme : "system",
    reminderDays: num("reminderDays", DEFAULTS.reminderDays),
    notifications: bool("notifications", DEFAULTS.notifications),
    launchCheck: bool("launchCheck", DEFAULTS.launchCheck),
    autoUpdate: bool("autoUpdate", DEFAULTS.autoUpdate),
    sidebarCollapsed: bool("sidebarCollapsed", DEFAULTS.sidebarCollapsed),
  };
}

const ser = (v: unknown) => (typeof v === "boolean" ? (v ? "1" : "0") : String(v));

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export const useSettings = create<State>((set, get) => ({
  ...DEFAULTS,
  raw: {},
  hydrate(raw) {
    const s = parse(raw);
    set({ ...s, raw });
    applyTheme(s.theme);
  },
  async set(key, value) {
    set({ [key]: value } as Partial<State>);
    if (key === "theme") applyTheme(value as Theme);
    set({ raw: { ...get().raw, [key]: ser(value) } });
    await getRepo().setSetting(key, ser(value));
  },
  getRaw: (key) => get().raw[key],
  async setRaw(key, value) {
    set({ raw: { ...get().raw, [key]: value } });
    await getRepo().setSetting(key, value);
  },
}));
