import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { AlertTriangle, CalendarClock, Plus, Receipt, ShoppingBag, Store } from "lucide-react";
import { useUI } from "../store/useUI";
import { usePlans } from "../store/usePlans";
import { useDerived } from "../lib/useDerived";
import { summarizeProvider } from "../lib/creditUsage";
import { formatJalaliMedium, relativeLabel } from "../lib/jalali";
import { formatToman, formatTomanCompact } from "../lib/money";
import { toFaDigits } from "../lib/digits";
import type { Provider } from "../lib/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState, PageHeader, Segmented } from "../components/ui/Misc";
import { PlanIcon } from "../components/ui/PlanIcon";
import { CreditBar } from "../components/CreditBar";
import { cn } from "../lib/utils";

export function ProviderModeBadges({ p }: { p: Pick<Provider, "supports_split" | "supports_statement"> }) {
  return (
    <>
      {p.supports_split ? <Badge tone="info">تقسیطی</Badge> : null}
      {p.supports_statement ? <Badge tone="warn">صورتحساب ماهانه</Badge> : null}
    </>
  );
}

export function Providers() {
  const providers = usePlans((s) => s.providers);
  const openProviderDialog = useUI((s) => s.openProviderDialog);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const { today, dueItems } = useDerived();
  const [archived, setArchived] = useState<"active" | "archived">("active");

  const cards = useMemo(
    () =>
      providers
        .filter((p) => (archived === "archived" ? !!p.archived : !p.archived))
        .map((p) => ({ p, s: summarizeProvider(p, dueItems, today) }))
        // soonest next due first; providers with nothing due go last
        .sort((a, b) => (a.s.next?.dueDate ?? "9999").localeCompare(b.s.next?.dueDate ?? "9999") || a.p.name.localeCompare(b.p.name, "fa")),
    [providers, dueItems, today, archived],
  );
  const archivedCount = providers.filter((p) => p.archived).length;

  return (
    <div>
      <PageHeader
        title="ارائه‌دهندگان"
        subtitle="شرکت‌ها، بانک‌ها و فروشگاه‌هایی که از آن‌ها قسطی خرید می‌کنید"
        actions={
          <>
            {archivedCount > 0 && (
              <Segmented
                value={archived}
                onChange={setArchived}
                options={[
                  { value: "active", label: "فعال" },
                  { value: "archived", label: "بایگانی" },
                ]}
              />
            )}
            {providers.length > 0 && (
              <Button variant="secondary" onClick={() => openQuickAdd()}>
                <ShoppingBag size={17} /> خرید جدید
              </Button>
            )}
            <Button variant="primary" onClick={() => openProviderDialog()}>
              <Plus size={18} /> افزودن ارائه‌دهنده
            </Button>
          </>
        }
      />

      {providers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface/60">
          <EmptyState
            icon={<Store size={38} />}
            title="هنوز ارائه‌دهنده‌ای ثبت نکرده‌اید"
            description="ارائه‌دهنده‌ها (مثل اسنپ‌پی، دیجی‌پی یا یک بانک) را اضافه کنید تا خریدهای کوچک و صورتحساب‌های ماهانه را سریع ثبت و پیگیری کنید."
            action={{ label: "افزودن اولین ارائه‌دهنده", onClick: () => openProviderDialog() }}
          />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface/60">
          <EmptyState icon={<Store size={36} />} title="موردی نیست" description="ارائه‌دهندهٔ بایگانی‌شده‌ای وجود ندارد." />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {cards.map(({ p, s }, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.3, ease: "easeOut" }}
            >
              <Link
                to={`/providers/${p.id}`}
                className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
              >
                <div className="absolute inset-x-0 top-0 h-1 opacity-80" style={{ background: p.color }} />
                <div className="flex items-center gap-3">
                  <PlanIcon icon={p.icon} color={p.color} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{p.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <ProviderModeBadges p={p} />
                      {p.archived ? <Badge>بایگانی</Badge> : null}
                    </div>
                  </div>
                  {s.overdueCount > 0 && (
                    <Badge tone="danger" className="shrink-0">
                      <AlertTriangle size={12} /> <span className="num">{toFaDigits(s.overdueCount)}</span> معوق
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted">مانده کل</div>
                    <div className="truncate text-[15px] font-extrabold num" title={formatToman(s.outstanding)}>
                      {s.outstanding > 0 ? formatTomanCompact(s.outstanding) + " تومان" : "—"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted">سررسید بعدی</div>
                    {s.next ? (
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium">
                          {s.next.kind === "statement" ? (
                            <Receipt size={14} className="shrink-0 text-muted" />
                          ) : (
                            <CalendarClock size={14} className={cn("shrink-0", !s.next.open && s.next.dueDate < today ? "text-danger" : "text-muted")} />
                          )}
                          <span className="truncate num">{formatJalaliMedium(s.next.dueDate)}</span>
                        </div>
                        <div className="truncate text-xs text-muted num">
                          <span className={cn(!s.next.open && s.next.dueDate < today && "text-danger-ink")}>{relativeLabel(s.next.dueDate, today)}</span> · {formatTomanCompact(s.next.remaining)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[13px] font-medium text-accent-ink">همه پرداخت شده</div>
                    )}
                  </div>
                </div>

                <CreditBar usage={s.usage} className="mt-auto" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
