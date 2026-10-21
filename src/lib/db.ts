import type { BackupFile, Installment, NewInstallment, NewPlan, Plan } from "./types";

/** Storage abstraction. Tauri => SQLite; plain browser (dev preview only) => localStorage. */
export interface Repo {
  init(): Promise<void>;
  load(): Promise<{ plans: Plan[]; installments: Installment[]; settings: Record<string, string> }>;
  insertPlan(plan: NewPlan, items: NewInstallment[]): Promise<number>;
  updatePlan(id: number, patch: Partial<NewPlan>): Promise<void>;
  /** Delete untouched (paid_amount = 0) installments of a plan and insert the given ones. */
  replaceUnpaid(planId: number, items: NewInstallment[]): Promise<void>;
  deletePlan(id: number): Promise<void>;
  updateInstallment(id: number, patch: Partial<Pick<Installment, "amount" | "due_date" | "paid_amount" | "paid_date" | "note">>): Promise<void>;
  setSetting(key: string, value: string): Promise<void>;
  importAll(data: BackupFile): Promise<void>;
  clearAll(): Promise<void>;
}

const now = () => new Date().toISOString();

const PLAN_COLS: (keyof NewPlan)[] = [
  "title", "direction", "counterparty", "category", "total_amount", "down_payment", "profit_rate",
  "installment_count", "installment_amount", "start_date", "interval_type", "interval_value",
  "color", "icon", "notes", "archived",
];

/* ------------------------------ SQLite (Tauri) ------------------------------ */

type SqlDb = {
  execute(q: string, b?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T>(q: string, b?: unknown[]): Promise<T>;
};

class SqliteRepo implements Repo {
  private db!: SqlDb;

  async init() {
    const mod = await import("@tauri-apps/plugin-sql");
    this.db = (await mod.default.load("sqlite:ghestyar.db")) as unknown as SqlDb;
    await this.db.execute("PRAGMA foreign_keys = ON");
  }

  async load() {
    const plans = await this.db.select<Plan[]>("SELECT * FROM plans ORDER BY id");
    const installments = await this.db.select<Installment[]>("SELECT * FROM installments ORDER BY plan_id, seq");
    const rows = await this.db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings");
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    return { plans, installments, settings };
  }

  private async insertItems(planId: number, items: NewInstallment[]) {
    for (const it of items) {
      await this.db.execute(
        "INSERT INTO installments (plan_id, seq, due_date, amount, paid_amount) VALUES ($1,$2,$3,$4,0)",
        [planId, it.seq, it.due_date, it.amount],
      );
    }
  }

  async insertPlan(plan: NewPlan, items: NewInstallment[]) {
    const t = now();
    const cols = [...PLAN_COLS, "created_at", "updated_at"];
    const vals = [...PLAN_COLS.map((c) => plan[c]), t, t];
    const res = await this.db.execute(
      `INSERT INTO plans (${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
      vals,
    );
    const id = res.lastInsertId as number;
    await this.insertItems(id, items);
    return id;
  }

  async updatePlan(id: number, patch: Partial<NewPlan>) {
    const keys = Object.keys(patch) as (keyof NewPlan)[];
    const sets = [...keys.map((k, i) => `${k} = $${i + 1}`), `updated_at = $${keys.length + 1}`];
    await this.db.execute(`UPDATE plans SET ${sets.join(", ")} WHERE id = $${keys.length + 2}`, [
      ...keys.map((k) => patch[k]),
      now(),
      id,
    ]);
  }

  async replaceUnpaid(planId: number, items: NewInstallment[]) {
    await this.db.execute("DELETE FROM installments WHERE plan_id = $1 AND paid_amount = 0", [planId]);
    await this.insertItems(planId, items);
  }

  async deletePlan(id: number) {
    await this.db.execute("DELETE FROM installments WHERE plan_id = $1", [id]);
    await this.db.execute("DELETE FROM plans WHERE id = $1", [id]);
  }

  async updateInstallment(id: number, patch: Partial<Installment>) {
    const keys = Object.keys(patch) as (keyof Installment)[];
    if (!keys.length) return;
    await this.db.execute(
      `UPDATE installments SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")} WHERE id = $${keys.length + 1}`,
      [...keys.map((k) => patch[k]), id],
    );
  }

  async setSetting(key: string, value: string) {
    await this.db.execute(
      "INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }

  async clearAll() {
    await this.db.execute("DELETE FROM installments");
    await this.db.execute("DELETE FROM plans");
    await this.db.execute("DELETE FROM settings");
    await this.db.execute("DELETE FROM sqlite_sequence WHERE name IN ('plans','installments')");
  }

  async importAll(data: BackupFile) {
    await this.clearAll();
    const pc = ["id", ...PLAN_COLS, "created_at", "updated_at"] as (keyof Plan)[];
    for (const p of data.plans) {
      await this.db.execute(
        `INSERT INTO plans (${pc.join(",")}) VALUES (${pc.map((_, i) => `$${i + 1}`).join(",")})`,
        pc.map((c) => p[c] ?? null),
      );
    }
    for (const i of data.installments) {
      await this.db.execute(
        "INSERT INTO installments (id, plan_id, seq, due_date, amount, paid_amount, paid_date, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [i.id, i.plan_id, i.seq, i.due_date, i.amount, i.paid_amount, i.paid_date ?? null, i.note ?? null],
      );
    }
    for (const [k, v] of Object.entries(data.settings ?? {})) await this.setSetting(k, v);
  }
}

/* --------------------------- localStorage (browser dev) --------------------------- */

interface MemState {
  plans: Plan[];
  installments: Installment[];
  settings: Record<string, string>;
  nextPlan: number;
  nextInst: number;
}

class MemoryRepo implements Repo {
  private s: MemState = { plans: [], installments: [], settings: {}, nextPlan: 1, nextInst: 1 };
  private key = "ghestyar-dev-db";

  async init() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) this.s = JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.s));
    } catch {
      /* ignore */
    }
  }
  async load() {
    return JSON.parse(JSON.stringify({ plans: this.s.plans, installments: this.s.installments, settings: this.s.settings }));
  }
  private addItems(planId: number, items: NewInstallment[]) {
    for (const it of items)
      this.s.installments.push({ id: this.s.nextInst++, plan_id: planId, seq: it.seq, due_date: it.due_date, amount: it.amount, paid_amount: 0, paid_date: null, note: null });
  }
  async insertPlan(plan: NewPlan, items: NewInstallment[]) {
    const id = this.s.nextPlan++;
    this.s.plans.push({ ...plan, id, created_at: now(), updated_at: now() });
    this.addItems(id, items);
    this.save();
    return id;
  }
  async updatePlan(id: number, patch: Partial<NewPlan>) {
    const p = this.s.plans.find((x) => x.id === id);
    if (p) Object.assign(p, patch, { updated_at: now() });
    this.save();
  }
  async replaceUnpaid(planId: number, items: NewInstallment[]) {
    this.s.installments = this.s.installments.filter((i) => !(i.plan_id === planId && i.paid_amount === 0));
    this.addItems(planId, items);
    this.save();
  }
  async deletePlan(id: number) {
    this.s.plans = this.s.plans.filter((p) => p.id !== id);
    this.s.installments = this.s.installments.filter((i) => i.plan_id !== id);
    this.save();
  }
  async updateInstallment(id: number, patch: Partial<Installment>) {
    const i = this.s.installments.find((x) => x.id === id);
    if (i) Object.assign(i, patch);
    this.save();
  }
  async setSetting(key: string, value: string) {
    this.s.settings[key] = value;
    this.save();
  }
  async clearAll() {
    this.s = { plans: [], installments: [], settings: {}, nextPlan: 1, nextInst: 1 };
    this.save();
  }
  async importAll(data: BackupFile) {
    this.s = {
      plans: data.plans,
      installments: data.installments,
      settings: data.settings ?? {},
      nextPlan: Math.max(0, ...data.plans.map((p) => p.id)) + 1,
      nextInst: Math.max(0, ...data.installments.map((i) => i.id)) + 1,
    };
    this.save();
  }
}

export const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let repo: Repo | null = null;
export function getRepo(): Repo {
  if (!repo) repo = isTauri() ? new SqliteRepo() : new MemoryRepo();
  return repo;
}
