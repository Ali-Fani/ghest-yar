import { isTauri } from "./db";
import { toJalali, todayISO } from "./jalali";
import type { BackupFile } from "./types";

function browserDownload(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save text through the native dialog. Returns false when the user cancelled. */
export async function saveTextFile(defaultName: string, content: string, ext: string, label: string): Promise<boolean> {
  if (!isTauri()) {
    browserDownload(defaultName, content, "text/plain;charset=utf-8");
    return true;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await save({ defaultPath: defaultName, filters: [{ name: label, extensions: [ext] }] });
  if (!path) return false;
  await writeTextFile(path, content);
  return true;
}

export async function readTextFileViaDialog(ext: string, label: string): Promise<string | null> {
  if (!isTauri()) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "." + ext;
      input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
      input.click();
    });
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await open({ multiple: false, filters: [{ name: label, extensions: [ext] }] });
  if (!path || Array.isArray(path)) return null;
  return readTextFile(path as string);
}

export function validateBackup(raw: unknown): BackupFile {
  const d = raw as Partial<BackupFile>;
  if (!d || d.app !== "ghestyar" || !Array.isArray(d.plans) || !Array.isArray(d.installments)) {
    throw new Error("فایل پشتیبان معتبر نیست");
  }
  return { app: "ghestyar", version: 1, exported_at: d.exported_at ?? "", plans: d.plans, installments: d.installments, settings: d.settings ?? {} };
}

export function backupFileName(): string {
  const j = toJalali(todayISO());
  const p = (n: number) => String(n).padStart(2, "0");
  return `ghestyar-backup-${j.y}${p(j.m)}${p(j.d)}.json`;
}

/** Quote a CSV cell. */
export function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a UTF-8 BOM CSV so Excel shows Persian correctly. */
export function buildCsv(rows: (string | number)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
