import type {
  BackupFile, Charge, DataSet, Installment, NewCharge, NewInstallment, NewPlan, NewProvider, NewStatement, Plan, Provider, Statement,
} from "./types";

/** Storage abstraction. Tauri => SQLite; plain browser (dev preview only) => localStorage. */
export interface Repo {
  init(): Promise<void>;
  load(): Promise<DataSet>;
  insertPlan(plan: NewPlan, items: NewInstallment[]): Promise<number>;
  updatePlan(id: number, patch: Partial<NewPlan>): Promise<void>;
  /** Delete untouched (paid_amount = 0) installments of a plan and insert the given ones. */
  replaceUnpaid(planId: number, items: NewInstallment[]): Promise<void>;
  deletePlan(id: number): Promise<void>;
  updateInstallment(id: number, patch: Partial<Pick<Installment, "amount" | "due_date" | "paid_amount" | "paid_date" | "note">>): Promise<void>;
  insertProvider(p: NewProvider): Promise<number>;
  updateProvider(id: number, patch: Partial<NewProvider>): Promise<void>;
  /** Deletes the provider with its charges and statements; its plans are kept (provider link cleared). */
  deleteProvider(id: number): Promise<void>;
  insertCharge(c: NewCharge): Promise<number>;
  updateCharge(id: number, patch: Partial<NewCharge>): Promise<void>;
  deleteCharge(id: number): Promise<void>;
  /** Insert the statement row for a cycle if it does not exist yet. Returns its id. */
  ensureStatement(s: NewStatement): Promise<number>;
  updateStatement(id: number, patch: Partial<Pick<Statement, "period_end" | "due_date" | "paid_amount" | "paid_date" | "split_plan_id" | "note">>): Promise<void>;
  deleteStatement(id: number): Promise<void>;
  setSetting(key: string, value: string): Promise<void>;
  importAll(data: BackupFile): Promise<void>;
  clearAll(): Promise<void>;
}

const now = () => new Date().toISOString();

const PLAN_COLS: (keyof NewPlan)[] = [
  "title", "direction", "counterparty", "category", "total_amount", "down_payment", "profit_rate",
  "installment_count", "installment_amount", "start_date", "interval_type", "interval_value",
  "color", "icon", "notes", "archived",
  "kind", "provider_id", "store", "purchase_date", "fee_type", "fee_value",
];

const PROVIDER_COLS: (keyof NewProvider)[] = [
  "name", "color", "icon", "credit_limit", "supports_split", "supports_statement", "preset_parts",
  "preset_interval_type", "preset_interval_value", "preset_first_at_purchase", "preset_fee_type", "preset_fee_value",
  "statement_close_day", "statement_due_offset", "statement_fee_type", "statement_fee_value", "notes", "archived",
];

const CHARGE_COLS: (keyof NewCharge)[] = ["provider_id", "date", "amount", "store", "title", "note"];

/** Defaults for the v1.2 plan columns, used when reading data written by older versions. */
export function withPlanDefaults(p: Partial<Plan> & Pick<Plan, "id">): Plan {
  return {
    kind: "loan", provider_id: null, store: null, purchase_date: null, fee_type: "none", fee_value: 0,
    ...p,
  } as Plan;
}

export function withProviderDefaults(p: Partial<Provider> & Pick<Provider, "id" | "name">): Provider {
  const t = now();
  return {
    color: "#10b981", icon: "card", credit_limit: null, supports_split: 1, supports_statement: 0, preset_parts: 4,
    preset_interval_type: "monthly", preset_interval_value: 1, preset_first_at_purchase: 1, preset_fee_type: "none",
    preset_fee_value: 0, statement_close_day: null, statement_due_offset: null, statement_fee_type: "none",
    statement_fee_value: 0, notes: null, archived: 0, created_at: t, updated_at: t,
    ...p,
  } as Provider;
}

export function withStatementDefaults(s: Partial<Statement> & Pick<Statement, "id" | "provider_id" | "period_start" | "period_end" | "due_date">): Statement {
  return { paid_amount: 0, paid_date: null, split_plan_id: null, note: null, ...s };
}

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

  async load(): Promise<DataSet> {
    const plans = await this.db.select<Plan[]>("SELECT * FROM plans ORDER BY id");
    const installments = await this.db.select<Installment[]>("SELECT * FROM installments ORDER BY plan_id, seq");
    const providers = await this.db.select<Provider[]>("SELECT * FROM providers ORDER BY id");
    const charges = await this.db.select<Charge[]>("SELECT * FROM charges ORDER BY date, id");
    const statements = await this.db.select<Statement[]>("SELECT * FROM statements ORDER BY provider_id, period_start");
    const rows = await this.db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings");
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    return { plans, installments, providers, charges, statements, settings };
  }

  private async insertItems(planId: number, items: NewInstallment[]) {
    for (const it of items) {
      await this.db.execute(
        "INSERT INTO installments (plan_id, seq, due_date, amount, paid_amount, paid_date) VALUES ($1,$2,$3,$4,$5,$6)",
        [planId, it.seq, it.due_date, it.amount, it.paid_amount ?? 0, it.paid_date ?? null],
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
    await this.db.execute("UPDATE statements SET split_plan_id = NULL WHERE split_plan_id = $1", [id]);
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

  async insertProvider(p: NewProvider) {
    const t = now();
    const cols = [...PROVIDER_COLS, "created_at", "updated_at"];
    const res = await this.db.execute(
      `INSERT INTO providers (${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
      [...PROVIDER_COLS.map((c) => p[c]), t, t],
    );
    return res.lastInsertId as number;
  }

  async updateProvider(id: number, patch: Partial<NewProvider>) {
    const keys = Object.keys(patch) as (keyof NewProvider)[];
    const sets = [...keys.map((k, i) => `${k} = $${i + 1}`), `updated_at = $${keys.length + 1}`];
    await this.db.execute(`UPDATE providers SET ${sets.join(", ")} WHERE id = $${keys.length + 2}`, [...keys.map((k) => patch[k]), now(), id]);
  }

  async deleteProvider(id: number) {
    await this.db.execute("UPDATE plans SET provider_id = NULL WHERE provider_id = $1", [id]);
    await this.db.execute("DELETE FROM statements WHERE provider_id = $1", [id]);
    await this.db.execute("DELETE FROM charges WHERE provider_id = $1", [id]);
    await this.db.execute("DELETE FROM providers WHERE id = $1", [id]);
  }

  async insertCharge(c: NewCharge) {
    const cols = [...CHARGE_COLS, "created_at"];
    const res = await this.db.execute(
      `INSERT INTO charges (${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
      [...CHARGE_COLS.map((k) => c[k]), now()],
    );
    return res.lastInsertId as number;
  }

  async updateCharge(id: number, patch: Partial<NewCharge>) {
    const keys = Object.keys(patch) as (keyof NewCharge)[];
    if (!keys.length) return;
    await this.db.execute(`UPDATE charges SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")} WHERE id = $${keys.length + 1}`, [...keys.map((k) => patch[k]), id]);
  }

  async deleteCharge(id: number) {
    await this.db.execute("DELETE FROM charges WHERE id = $1", [id]);
  }

  async ensureStatement(s: NewStatement) {
    await this.db.execute(
      "INSERT OR IGNORE INTO statements (provider_id, period_start, period_end, due_date) VALUES ($1,$2,$3,$4)",
      [s.provider_id, s.period_start, s.period_end, s.due_date],
    );
    const rows = await this.db.select<{ id: number }[]>("SELECT id FROM statements WHERE provider_id = $1 AND period_start = $2", [s.provider_id, s.period_start]);
    return rows[0].id;
  }

  async updateStatement(id: number, patch: Partial<Statement>) {
    const keys = Object.keys(patch) as (keyof Statement)[];
    if (!keys.length) return;
    await this.db.execute(`UPDATE statements SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")} WHERE id = $${keys.length + 1}`, [...keys.map((k) => patch[k]), id]);
  }

  async deleteStatement(id: number) {
    await this.db.execute("DELETE FROM statements WHERE id = $1", [id]);
  }

  async setSetting(key: string, value: string) {
    await this.db.execute(
      "INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }

  async clearAll() {
    await this.db.execute("DELETE FROM statements");
    await this.db.execute("DELETE FROM charges");
    await this.db.execute("DELETE FROM installments");
    await this.db.execute("DELETE FROM plans");
    await this.db.execute("DELETE FROM providers");
    await this.db.execute("DELETE FROM settings");
    await this.db.execute("DELETE FROM sqlite_sequence WHERE name IN ('plans','installments','providers','charges','statements')");
  }

  async importAll(data: BackupFile) {
    await this.clearAll();
    // Providers first: plans reference them.
    const vc = ["id", ...PROVIDER_COLS, "created_at", "updated_at"] as (keyof Provider)[];
    for (const raw of data.providers ?? []) {
      const p = withProviderDefaults(raw);
      await this.db.execute(
        `INSERT INTO providers (${vc.join(",")}) VALUES (${vc.map((_, i) => `$${i + 1}`).join(",")})`,
        vc.map((c) => p[c] ?? null),
      );
    }
    const pc = ["id", ...PLAN_COLS, "created_at", "updated_at"] as (keyof Plan)[];
    for (const raw of data.plans) {
      const p = withPlanDefaults(raw);
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
    for (const c of data.charges ?? []) {
      await this.db.execute(
        "INSERT INTO charges (id, provider_id, date, amount, store, title, note, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [c.id, c.provider_id, c.date, c.amount, c.store ?? null, c.title ?? null, c.note ?? null, c.created_at ?? now()],
      );
    }
    for (const s of data.statements ?? []) {
      await this.db.execute(
        "INSERT INTO statements (id, provider_id, period_start, period_end, due_date, paid_amount, paid_date, split_plan_id, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [s.id, s.provider_id, s.period_start, s.period_end, s.due_date, s.paid_amount ?? 0, s.paid_date ?? null, s.split_plan_id ?? null, s.note ?? null],
      );
    }
    for (const [k, v] of Object.entries(data.settings ?? {})) await this.setSetting(k, v);
  }
}

/* --------------------------- localStorage (browser dev) --------------------------- */

interface MemState {
  plans: Plan[];
  installments: Installment[];
  providers: Provider[];
  charges: Charge[];
  statements: Statement[];
  settings: Record<string, string>;
  nextPlan: number;
  nextInst: number;
  nextProvider: number;
  nextCharge: number;
  nextStatement: number;
}

const emptyMem = (): MemState => ({
  plans: [], installments: [], providers: [], charges: [], statements: [], settings: {},
  nextPlan: 1, nextInst: 1, nextProvider: 1, nextCharge: 1, nextStatement: 1,
});

class MemoryRepo implements Repo {
  private s: MemState = emptyMem();
  private key = "ghestyar-dev-db";

  async init() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        // Merge over defaults so state saved by older dev builds still loads.
        const d = { ...emptyMem(), ...JSON.parse(raw) } as MemState;
        d.plans = d.plans.map((p) => withPlanDefaults(p));
        this.s = d;
      }
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
  async load(): Promise<DataSet> {
    const { plans, installments, providers, charges, statements, settings } = this.s;
    return JSON.parse(JSON.stringify({ plans, installments, providers, charges, statements, settings }));
  }
  private addItems(planId: number, items: NewInstallment[]) {
    for (const it of items)
      this.s.installments.push({
        id: this.s.nextInst++, plan_id: planId, seq: it.seq, due_date: it.due_date, amount: it.amount,
        paid_amount: it.paid_amount ?? 0, paid_date: it.paid_date ?? null, note: null,
      });
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
    for (const st of this.s.statements) if (st.split_plan_id === id) st.split_plan_id = null;
    this.save();
  }
  async updateInstallment(id: number, patch: Partial<Installment>) {
    const i = this.s.installments.find((x) => x.id === id);
    if (i) Object.assign(i, patch);
    this.save();
  }
  async insertProvider(p: NewProvider) {
    const id = this.s.nextProvider++;
    this.s.providers.push({ ...p, id, created_at: now(), updated_at: now() });
    this.save();
    return id;
  }
  async updateProvider(id: number, patch: Partial<NewProvider>) {
    const p = this.s.providers.find((x) => x.id === id);
    if (p) Object.assign(p, patch, { updated_at: now() });
    this.save();
  }
  async deleteProvider(id: number) {
    for (const p of this.s.plans) if (p.provider_id === id) p.provider_id = null;
    this.s.statements = this.s.statements.filter((x) => x.provider_id !== id);
    this.s.charges = this.s.charges.filter((x) => x.provider_id !== id);
    this.s.providers = this.s.providers.filter((x) => x.id !== id);
    this.save();
  }
  async insertCharge(c: NewCharge) {
    const id = this.s.nextCharge++;
    this.s.charges.push({ ...c, id, created_at: now() });
    this.save();
    return id;
  }
  async updateCharge(id: number, patch: Partial<NewCharge>) {
    const c = this.s.charges.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
    this.save();
  }
  async deleteCharge(id: number) {
    this.s.charges = this.s.charges.filter((x) => x.id !== id);
    this.save();
  }
  async ensureStatement(s: NewStatement) {
    const ex = this.s.statements.find((x) => x.provider_id === s.provider_id && x.period_start === s.period_start);
    if (ex) return ex.id;
    const id = this.s.nextStatement++;
    this.s.statements.push({ ...s, id, paid_amount: 0, paid_date: null, split_plan_id: null, note: null });
    this.save();
    return id;
  }
  async updateStatement(id: number, patch: Partial<Statement>) {
    const st = this.s.statements.find((x) => x.id === id);
    if (st) Object.assign(st, patch);
    this.save();
  }
  async deleteStatement(id: number) {
    this.s.statements = this.s.statements.filter((x) => x.id !== id);
    this.save();
  }
  async setSetting(key: string, value: string) {
    this.s.settings[key] = value;
    this.save();
  }
  async clearAll() {
    this.s = emptyMem();
    this.save();
  }
  async importAll(data: BackupFile) {
    const providers = (data.providers ?? []).map((p) => withProviderDefaults(p));
    const charges = data.charges ?? [];
    const statements = (data.statements ?? []).map((s) => withStatementDefaults(s));
    const nextId = (a: { id: number }[]) => Math.max(0, ...a.map((x) => x.id)) + 1;
    this.s = {
      plans: data.plans.map((p) => withPlanDefaults(p)),
      installments: data.installments,
      providers,
      charges,
      statements,
      settings: data.settings ?? {},
      nextPlan: nextId(data.plans),
      nextInst: nextId(data.installments),
      nextProvider: nextId(providers),
      nextCharge: nextId(charges),
      nextStatement: nextId(statements),
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

/** Test hook: drop the cached repo so a fresh in-memory one is created. */
export function resetRepoForTests() {
  repo = null;
}
