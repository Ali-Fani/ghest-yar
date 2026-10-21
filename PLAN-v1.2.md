# قسط‌یار v1.2 — Providers, Pay-in-4 and BNPL (split + statement)

Extends [PLAN.md](PLAN.md). Everything there still applies (RTL, Persian digits, Jalali-only UI, integer Toman, polished UI, dark mode).

## 1. Goals
- **Providers (ارائه‌دهندگان)**: first-class entities such as اسنپ‌پی, دیجی‌پی, تارا, a bank, or a store. Each has its own identity, credit limit, totals and presets.
- **Mode A: split purchase (خرید قسطی/Pay-in-4)**: each purchase becomes its own short schedule, generated from the provider's preset. It reuses the existing plan and installment engine.
- **Mode B: monthly statement (صورتحساب اعتباری)**: purchases go into a billing cycle. Each cycle produces **one** due item (the statement) on a fixed day. You pay the statement in full or in part.
- One provider may support **both** modes. The mode is chosen per purchase.
- Very fast entry for many small purchases.

## 2. Data model: migration **version 2**, append-only (never edit migration 1)

```sql
CREATE TABLE providers (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  color TEXT NOT NULL, icon TEXT NOT NULL,          -- generic lucide icon + color; no brand logos
  credit_limit INTEGER,                              -- Toman, nullable
  supports_split INTEGER NOT NULL DEFAULT 1,
  supports_statement INTEGER NOT NULL DEFAULT 0,
  -- split preset (mode A)
  preset_parts INTEGER NOT NULL DEFAULT 4,
  preset_interval_type TEXT NOT NULL DEFAULT 'monthly',  -- monthly|weekly|days
  preset_interval_value INTEGER NOT NULL DEFAULT 1,
  preset_first_at_purchase INTEGER NOT NULL DEFAULT 1,   -- part 1 due (and paid) on purchase date
  preset_fee_type TEXT NOT NULL DEFAULT 'none',          -- none|fixed|percent
  preset_fee_value REAL NOT NULL DEFAULT 0,              -- Toman if fixed, % of purchase if percent
  -- statement settings (mode B)
  statement_close_day INTEGER,      -- Jalali day of month the cycle closes (1..31, clamped to month length)
  statement_due_offset INTEGER,     -- days after close that payment is due
  statement_fee_type TEXT NOT NULL DEFAULT 'none',       -- none|fixed|percent (of statement total)
  statement_fee_value REAL NOT NULL DEFAULT 0,
  notes TEXT, archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

ALTER TABLE plans ADD COLUMN kind TEXT NOT NULL DEFAULT 'loan';
  -- loan | purchase (خرید قسطی) | pay_in_4 | bnpl | personal
ALTER TABLE plans ADD COLUMN provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL;
ALTER TABLE plans ADD COLUMN store TEXT;                  -- merchant name
ALTER TABLE plans ADD COLUMN purchase_date TEXT;          -- ISO
ALTER TABLE plans ADD COLUMN fee_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE plans ADD COLUMN fee_value REAL NOT NULL DEFAULT 0;

CREATE TABLE charges (            -- purchases on a statement (mode B)
  id INTEGER PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  date TEXT NOT NULL, amount INTEGER NOT NULL,
  store TEXT, title TEXT, note TEXT, created_at TEXT NOT NULL
);

CREATE TABLE statements (         -- one row per closed or open cycle, created lazily
  id INTEGER PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL, period_end TEXT NOT NULL, due_date TEXT NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0, paid_date TEXT,
  split_plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,  -- when the statement was converted to installments
  note TEXT,
  UNIQUE(provider_id, period_start)
);
```

Existing plans get `kind='loan'` by default. Existing data must be untouched and keep working.

## 3. Logic (pure functions in `src/lib/`, all unit-tested)

### `cycles.ts` (statement cycles)
- `cycleFor(date, closeDay)` → `{start, end}`. The cycle ends on the Jalali `closeDay` of the month, clamped to the month length (e.g. close day 31 in Mehr → ۳۰ مهر). It starts the day after the previous close.
- `dueDateFor(cycle, offsetDays)` = `end + offset`.
- Statement amount = Σ charges with `date ∈ [start, end]`, plus the statement fee (fixed, or % of the charge total, rounded to 1,000).
- Statements are **derived**. The DB row only stores payments and the split link. `ensureStatements(provider)` upserts a row for every cycle that has charges, up to the current open cycle.
- Statement states:
  - `open`: the cycle has not ended yet. The amount is still growing, and it shows as «صورتحساب جاری».
  - `due`: the cycle is closed and the bill is unpaid.
  - `overdue`
  - `partial`
  - `paid`
  - `split`: converted to installments.
- Backdated charges fold into their cycle automatically. If that cycle's statement was already paid in full, the statement becomes partial and the UI warns about it.

### Split purchases (mode A), via `schedule.ts` extension
- `generateSplit({amount, parts, intervalType, intervalValue, firstAtPurchase, purchaseDate, feeType, feeValue})`
- Fee: fixed or % of the purchase. It is **spread equally** across parts using the same rounding rule as today (round to 1,000, remainder on the last part).
- If `firstAtPurchase` is set, part 1 is due on the purchase date and is **auto-marked paid**; the rest follow at the interval from the purchase date. Otherwise part 1 is due one interval after the purchase.
- Saved as a normal `plan` (kind `pay_in_4` if parts = 4 with first-at-purchase, else `bnpl`) plus normal `installments`. Everything existing, such as the detail page, mark paid and reminders, keeps working.

### Converting a statement to installments (تقسیط صورتحساب)
On a due statement, the user can choose «تقسیط این صورتحساب» and pick parts, interval and fee. This creates a `bnpl` plan for the statement's remaining amount, sets `statements.split_plan_id`, and the statement shows as `split`, no longer due on its own. Undo is possible by deleting that plan.

### Unified due items (`dueItems.ts`)
This is critical. A single `DueItem` type covers **installments and statements**:
`{ kind: 'installment'|'statement', id, providerId?, planId?, title, dueDate, amount, paid, status }`

Dashboard, calendar, reminders and notifications, the overdue badge, reports, CSV and the Ctrl+K search all consume `DueItem[]` instead of installments directly. Refactor those to use it, so statements appear everywhere installments do.

### Credit limit usage
Usage counts the following:
- unpaid installments of the provider's plans
- unpaid amounts of the provider's closed statements
- the open cycle's charges

Display: «۶٫۲ از ۱۰ میلیون» with a bar. It turns amber at ≥ 80% and rose at ≥ 100%.

## 4. UI

1. **Sidebar:** a new item «ارائه‌دهندگان» between «اقساط من» and «تقویم».
2. **Providers page:** a grid of provider cards. Each card shows:
   - the color and icon, and the name
   - mode badges («تقسیطی»، «صورتحساب ماهانه»)
   - the outstanding total and the next due date with its amount
   - the credit-limit bar
   - an empty state with a CTA
   «افزودن ارائه‌دهنده» opens a dialog with **quick-pick name chips** (اسنپ‌پی، دیجی‌پی، تارا، بانک، فروشگاه، سفارشی) that only prefill the name. **No provider terms are hard-coded.** The user configures the presets, with a generic default of 4 parts, monthly, first at purchase, and no fee.
3. **Provider detail page:**
   - **Header:** the provider's identity, the outstanding total, the limit bar, the next due item, and the buttons «خرید جدید» and «ویرایش».
   - **Tabs:**
     - «خریدهای قسطی»: plan cards for mode A, filterable by active or finished.
     - «صورتحساب‌ها»: statements newest first. The open cycle sits at the top with a live total and its close and due dates. Each statement expands to show its charges and supports pay, partial pay, undo, and «تقسیط».
     - «خریدهای صورتحساب»: the charge list with add, edit and delete.
     - «تنظیمات»: the presets and statement settings, with a live example. For close day 25 and offset 10, it shows «خرید ۱۴۰۵/۰۸/۲۰ ← صورتحساب ۲۵ آبان ← سررسید ۵ آذر».
4. **Quick add («خرید جدید», `Ctrl+Shift+N`, and also in the command palette):** a compact dialog, optimised for speed.
   - Pick the provider. The last-used provider is preselected, and a recent-providers row is shown.
   - Enter the amount (MoneyInput), the store or title, and the date (default today).
   - Choose the mode with a segmented control «تقسیط (Pay-in-4)» / «به صورتحساب». It is hidden when the provider supports only one mode.
   - A live preview shows either the parts with Jalali dates and amounts, or which statement the purchase falls into with that statement's due date.
   - `Enter` saves. «ذخیره و بعدی» keeps the dialog open for rapid entry.
5. **Plan wizard:** step 1 gains a **type** selector (وام، خرید قسطی، Pay-in-4، BNPL، شخصی) and an optional **provider**. Choosing a provider applies its preset to step 2. The fee type/value fields sit next to the profit rate.
6. **Plans list:** add filters for type and provider. Cards show the provider chip and the store.
7. **Dashboard:**
   - a **«این هفته»** strip: the next 7 days as day columns, with due items grouped per day
   - a **per-provider** card: outstanding amount and next due, sorted by soonest
   - same-day items from one provider are grouped into one row («۳ قسط اسنپ‌پی — ۴٫۲ میلیون»), which expands
   - statements appear in the upcoming and overdue lists with a «صورتحساب» badge
8. **Calendar:** statements are shown with a distinct receipt-style pill. Open cycles show their close date as a subtle marker.
9. **Reports:** a per-provider breakdown and a per-type breakdown.
10. **Reminders:** they include statements («صورتحساب دیجی‌پی تا ۲ روز دیگر — ۳٫۱ میلیون»). Optionally, a heads-up 1 day before a cycle closes, behind a setting that is off by default.

## 5. Backup / CSV
- Backup JSON gets `schemaVersion: 2` and includes `providers`, `charges` and `statements`.
- **Importing a v1 backup must still work**, using defaults for the new fields.
- CSV export includes statements as rows, and adds provider and type columns.

## 6. Tests (Vitest)
- **Cycles:** close-day clamping (31 in a 30-day month, and Esfand in leap and non-leap years), the cycle a date falls in, the due offset across a month boundary, and backdated charges.
- **Split:** fee spreading, the rounding remainder, first-at-purchase (part 1 paid, on the purchase date), weekly and 14-day intervals, and amounts that sum exactly.
- **Statement fee** and the statement state machine.
- **Credit limit usage.**
- **`DueItem` merge and sort.**
- **Backup:** a v1 backup imports correctly into the v2 schema.

## 7. Release
- Update the CHANGELOG with 1.2.0 (Persian text plus an English one-liner).
- Commit per phase, then create the version and tag with `npm run release:minor` (1.2.0). **Do not push.**
