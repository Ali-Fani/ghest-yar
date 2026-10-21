import { toFaDigits } from "./digits";

declare const __APP_VERSION__: string;

/** Version from package.json, injected by Vite at build time. */
export const BUILD_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

/** Real app version in Tauri; falls back to the Vite-injected one in the browser. */
export async function getAppVersion(): Promise<string> {
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return BUILD_VERSION;
  }
}

/** "1.0.1" -> "۱٫۰٫۱" */
export function faVersion(v: string): string {
  return toFaDigits(v).replace(/\./g, "٫");
}
