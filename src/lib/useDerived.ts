import { useMemo } from "react";
import { usePlans } from "../store/usePlans";
import { useSettings } from "../store/useSettings";
import { todayISO } from "./jalali";
import { buildAllStatements, buildDueItems, type DueItem } from "./dueItems";
import type { StatementView } from "./cycles";
import type { Plan, Provider } from "./types";

export interface Derived {
  today: string;
  planById: Map<number, Plan>;
  providerById: Map<number, Provider>;
  statementViews: StatementView[];
  /** Installments + statements, sorted by due date. Includes receivables and paid items; filter as needed. */
  dueItems: DueItem[];
}

/** Single place that turns raw store data into statements and unified DueItems. */
export function useDerived(): Derived {
  const plans = usePlans((s) => s.plans);
  const installments = usePlans((s) => s.installments);
  const providers = usePlans((s) => s.providers);
  const charges = usePlans((s) => s.charges);
  const statements = usePlans((s) => s.statements);
  const reminderDays = useSettings((s) => s.reminderDays);
  const today = todayISO();
  return useMemo(() => {
    const statementViews = buildAllStatements(providers, charges, statements, today);
    const dueItems = buildDueItems({ plans, installments, providers, statementViews, today, reminderDays });
    return {
      today,
      planById: new Map(plans.map((p) => [p.id, p])),
      providerById: new Map(providers.map((p) => [p.id, p])),
      statementViews,
      dueItems,
    };
  }, [plans, installments, providers, charges, statements, reminderDays, today]);
}
