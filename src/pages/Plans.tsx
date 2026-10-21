import { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search, WalletCards } from "lucide-react";
import { motion } from "motion/react";
import { usePlans } from "../store/usePlans";
import { useUI } from "../store/useUI";
import { computePlanStats } from "../lib/derive";
import { todayISO } from "../lib/jalali";
import { toFaDigits } from "../lib/digits";
import { CATEGORIES } from "../lib/constants";
import { PlanCard } from "../components/PlanCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { EmptyState, PageHeader, Segmented } from "../components/ui/Misc";

type StatusFilter = "active" | "finished" | "archived";

export function Plans() {
  const { plans, installments } = usePlans();
  const openWizard = useUI((s) => s.openWizard);
  const [q, setQ] = useState("");
  const [dir, setDir] = useState("all");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [sort, setSort] = useState("due");
  const [view, setView] = useState<"grid" | "list">("grid");

  const today = todayISO();
  const stats = useMemo(() => plans.map((p) => computePlanStats(p, installments, today)), [plans, installments, today]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = stats.filter((s) => {
      const p = s.plan;
      if (status === "archived" ? !p.archived : p.archived) return false;
      if (status === "active" && s.finished) return false;
      if (status === "finished" && !s.finished) return false;
      if (dir !== "all" && p.direction !== dir) return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (needle && !`${p.title} ${p.counterparty ?? ""} ${p.category ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      switch (sort) {
        case "remaining": return b.remainingSum - a.remainingSum;
        case "newest": return b.plan.id - a.plan.id;
        case "name": return a.plan.title.localeCompare(b.plan.title, "fa");
        default: return (a.next?.due_date ?? "9999").localeCompare(b.next?.due_date ?? "9999");
      }
    });
    return r;
  }, [stats, q, dir, cat, status, sort]);

  const counts = {
    active: stats.filter((s) => !s.plan.archived && !s.finished).length,
    finished: stats.filter((s) => !s.plan.archived && s.finished).length,
    archived: stats.filter((s) => s.plan.archived).length,
  };

  return (
    <div>
      <PageHeader
        title="اقساط من"
        subtitle="همه برنامه‌های اقساط شما در یک نگاه"
        actions={
          <Button variant="primary" onClick={() => openWizard()}>
            <Plus size={18} /> قسط جدید
          </Button>
        }
      />

      {plans.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface/60">
          <EmptyState
            icon={<WalletCards size={38} />}
            title="هنوز قسطی ثبت نکرده‌اید"
            description="اولین برنامه اقساط خود را بسازید تا سررسیدها، پرداخت‌ها و یادآوری‌ها به‌صورت خودکار مدیریت شوند."
            action={{ label: "ساخت اولین قسط", onClick: () => openWizard() }}
          />
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative w-72">
              <Search size={16} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در عنوان، طرف حساب…" className="ps-9" />
            </div>
            <Select
              className="w-40"
              value={dir}
              onValueChange={setDir}
              options={[
                { value: "all", label: "همه انواع" },
                { value: "payable", label: "بدهی من" },
                { value: "receivable", label: "طلب من" },
              ]}
            />
            <Select className="w-40" value={cat} onValueChange={setCat} options={[{ value: "all", label: "همه دسته‌ها" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
            <Select
              className="w-48"
              value={sort}
              onValueChange={setSort}
              options={[
                { value: "due", label: "نزدیک‌ترین سررسید" },
                { value: "remaining", label: "بیشترین مانده" },
                { value: "newest", label: "تازه‌ترین" },
                { value: "name", label: "بر اساس نام" },
              ]}
            />
            <div className="ms-auto flex items-center gap-3">
              <Segmented
                value={status}
                onChange={setStatus}
                options={[
                  { value: "active", label: `فعال` },
                  { value: "finished", label: "تمام‌شده" },
                  { value: "archived", label: "بایگانی" },
                ]}
              />
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: "grid", label: <LayoutGrid size={16} /> },
                  { value: "list", label: <List size={16} /> },
                ]}
              />
            </div>
          </div>
          <div className="mb-3 text-xs text-muted">
            {toFaDigits(counts.active)} فعال · {toFaDigits(counts.finished)} تمام‌شده · {toFaDigits(counts.archived)} بایگانی
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line bg-surface/60">
              <EmptyState icon={<Search size={36} />} title="موردی پیدا نشد" description="فیلترها یا عبارت جستجو را تغییر دهید." />
            </div>
          ) : (
            <motion.div
              layout
              className={view === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4" : "flex flex-col gap-3"}
            >
              {filtered.map((s, i) => (
                <PlanCard key={s.plan.id} s={s} index={i} list={view === "list"} />
              ))}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
