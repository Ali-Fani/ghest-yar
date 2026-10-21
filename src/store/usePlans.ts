import { create } from "zustand";
import { getRepo } from "../lib/db";
import { buildStatements, planStatementSync, type StatementView } from "../lib/cycles";
import { formatJalaliMedium, todayISO } from "../lib/jalali";
import { buildSplitPlan, type SplitPurchaseInput } from "../lib/purchase";
import { isPaid } from "../lib/status";
import type { BackupFile, Charge, Installment, NewCharge, NewInstallment, NewPlan, NewProvider, Provider, Statement } from "../lib/types";
import { useSettings } from "./useSettings";

interface PlansState {
  plans: import("../lib/types").Plan[];
  installments: Installment[];
  providers: Provider[];
  charges: Charge[];
  statements: Statement[];
  loaded: boolean;
  init(): Promise<void>;
  reload(): Promise<void>;
  createPlan(plan: NewPlan, items: NewInstallment[]): Promise<number>;
  /** Save plan edits; when `items` is given, unpaid installments are regenerated (paid ones kept). */
  savePlan(id: number, patch: Partial<NewPlan>, items?: NewInstallment[]): Promise<void>;
  deletePlan(id: number): Promise<void>;
  setArchived(id: number, archived: boolean): Promise<void>;
  /** Set payment on an installment. Returns whether its plan became fully paid. */
  setPayment(id: number, paidAmount: number, paidDate: string | null): Promise<{ planFinished: boolean }>;
  payFull(id: number, date?: string): Promise<{ planFinished: boolean; prev: { paid_amount: number; paid_date: string | null } }>;
  restorePayment(id: number, prev: { paid_amount: number; paid_date: string | null }): Promise<void>;
  undoPayment(id: number): Promise<void>;
  updateInstallment(id: number, patch: Partial<Pick<Installment, "amount" | "due_date" | "note">>): Promise<void>;
  createProvider(p: NewProvider): Promise<number>;
  saveProvider(id: number, patch: Partial<NewProvider>): Promise<void>;
  /** Removes the provider with its charges and statements; its plans stay. */
  deleteProvider(id: number): Promise<void>;
  /** Quick add, mode A: create a split purchase (Pay-in-4 / BNPL) for a provider. Returns the plan id. */
  addSplitPurchase(provider: Provider, input: SplitPurchaseInput): Promise<number>;
  /** Create missing statement rows for cycles that have charges and refresh stale due dates. */
  ensureStatements(): Promise<void>;
  /** Set the total paid on a statement (creating its row on demand). */
  setStatementPayment(v: StatementView, paidAmount: number, paidDate: string | null): Promise<void>;
  /** «تقسیط صورتحساب»: create a BNPL plan for the statement's remaining amount and link it. Returns the plan id. */
  splitStatement(
    v: StatementView,
    provider: Provider,
    params: Pick<SplitPurchaseInput, "parts" | "intervalType" | "intervalValue" | "feeType" | "feeValue">,
  ): Promise<number>;
  addCharge(c: NewCharge): Promise<number>;
  saveCharge(id: number, patch: Partial<NewCharge>): Promise<void>;
  removeCharge(id: number): Promise<void>;
  exportData(): BackupFile;
  importData(data: BackupFile): Promise<void>;
  clearAll(): Promise<void>;
}

export const usePlans = create<PlansState>((set, get) => ({
  plans: [],
  installments: [],
  providers: [],
  charges: [],
  statements: [],
  loaded: false,

  async init() {
    const repo = getRepo();
    await repo.init();
    const d = await repo.load();
    useSettings.getState().hydrate(d.settings);
    set({ plans: d.plans, installments: d.installments, providers: d.providers, charges: d.charges, statements: d.statements, loaded: true });
    await get().ensureStatements();
  },

  async reload() {
    const d = await getRepo().load();
    set({ plans: d.plans, installments: d.installments, providers: d.providers, charges: d.charges, statements: d.statements });
  },

  async createPlan(plan, items) {
    const id = await getRepo().insertPlan(plan, items);
    await get().reload();
    return id;
  },

  async savePlan(id, patch, items) {
    const repo = getRepo();
    await repo.updatePlan(id, patch);
    if (items) await repo.replaceUnpaid(id, items);
    await get().reload();
  },

  async deletePlan(id) {
    await getRepo().deletePlan(id);
    await get().reload();
  },

  async setArchived(id, archived) {
    await getRepo().updatePlan(id, { archived: archived ? 1 : 0 });
    await get().reload();
  },

  async setPayment(id, paidAmount, paidDate) {
    await getRepo().updateInstallment(id, { paid_amount: paidAmount, paid_date: paidDate });
    await get().reload();
    const inst = get().installments.find((i) => i.id === id);
    const siblings = get().installments.filter((i) => i.plan_id === inst?.plan_id);
    return { planFinished: !!inst && siblings.length > 0 && siblings.every(isPaid) };
  },

  async payFull(id, date) {
    const inst = get().installments.find((i) => i.id === id)!;
    const prev = { paid_amount: inst.paid_amount, paid_date: inst.paid_date };
    const r = await get().setPayment(id, inst.amount, date ?? todayISO());
    return { ...r, prev };
  },

  async restorePayment(id, prev) {
    await get().setPayment(id, prev.paid_amount, prev.paid_date);
  },

  async undoPayment(id) {
    await get().setPayment(id, 0, null);
  },

  async updateInstallment(id, patch) {
    await getRepo().updateInstallment(id, patch);
    await get().reload();
  },

  async createProvider(p) {
    const id = await getRepo().insertProvider(p);
    await get().reload();
    return id;
  },

  async saveProvider(id, patch) {
    const repo = getRepo();
    const before = get().providers.find((p) => p.id === id);
    await repo.updateProvider(id, patch);
    // Statement cycles are derived from the close day: drop untouched rows so they are rebuilt on the new boundaries.
    if (before && patch.statement_close_day !== undefined && patch.statement_close_day !== before.statement_close_day) {
      for (const st of get().statements.filter((x) => x.provider_id === id && x.paid_amount === 0 && x.split_plan_id == null)) {
        await repo.deleteStatement(st.id);
      }
    }
    await get().reload();
    await get().ensureStatements();
  },

  async deleteProvider(id) {
    await getRepo().deleteProvider(id);
    await get().reload();
  },

  async addSplitPurchase(provider, input) {
    const { plan, result } = buildSplitPlan(provider, input);
    return get().createPlan(plan, result.items);
  },

  async ensureStatements() {
    const { providers, charges, statements } = get();
    const repo = getRepo();
    const today = todayISO();
    let changed = false;
    for (const p of providers) {
      const views = buildStatements(p, charges, statements, today);
      const { create, staleDue } = planStatementSync(views, statements);
      for (const row of create) {
        await repo.ensureStatement(row);
        changed = true;
      }
      for (const s of staleDue) {
        await repo.updateStatement(s.id, { due_date: s.due_date });
        changed = true;
      }
    }
    if (changed) await get().reload();
  },

  async setStatementPayment(v, paidAmount, paidDate) {
    const repo = getRepo();
    const id = v.id ?? (await repo.ensureStatement({ provider_id: v.providerId, period_start: v.start, period_end: v.end, due_date: v.dueDate }));
    await repo.updateStatement(id, { paid_amount: paidAmount, paid_date: paidDate });
    await get().reload();
  },

  async splitStatement(v, provider, params) {
    const repo = getRepo();
    const { plan, result } = buildSplitPlan(provider, {
      ...params,
      amount: v.remaining,
      title: `تقسیط صورتحساب ${provider.name} (${formatJalaliMedium(v.end)})`,
      store: null,
      date: todayISO(),
      firstAtPurchase: false,
    });
    const planId = await repo.insertPlan({ ...plan, kind: "bnpl" }, result.items);
    const id = v.id ?? (await repo.ensureStatement({ provider_id: v.providerId, period_start: v.start, period_end: v.end, due_date: v.dueDate }));
    await repo.updateStatement(id, { split_plan_id: planId });
    await get().reload();
    return planId;
  },

  async addCharge(c) {
    const id = await getRepo().insertCharge(c);
    await get().reload();
    await get().ensureStatements();
    return id;
  },

  async saveCharge(id, patch) {
    await getRepo().updateCharge(id, patch);
    await get().reload();
    await get().ensureStatements();
  },

  async removeCharge(id) {
    await getRepo().deleteCharge(id);
    await get().reload();
    await get().ensureStatements();
  },

  exportData() {
    const raw = useSettings.getState().raw;
    const settings = { ...raw };
    delete settings.last_notified;
    return {
      app: "ghestyar",
      version: 2,
      schemaVersion: 2,
      exported_at: new Date().toISOString(),
      plans: get().plans,
      installments: get().installments,
      providers: get().providers,
      charges: get().charges,
      statements: get().statements,
      settings,
    };
  },

  async importData(data) {
    await getRepo().importAll(data);
    await get().init();
  },

  async clearAll() {
    await getRepo().clearAll();
    await get().init();
  },
}));
