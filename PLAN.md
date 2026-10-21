# قسط‌یار (Ghest-Yar) — Installments Tracker for Windows

Persian (RTL) desktop app to track installments (اقساط), fully Jalali-calendar based, currency Iranian **Toman**.

---

## 1. Tech stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Tauri 2** (Rust, MSVC toolchain already installed) | ~10 MB installer, native WebView2 on Windows 11, fast startup — much lighter than Electron |
| UI | **React 19 + TypeScript + Vite** | Standard, fast HMR |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) using logical properties (`ps-`, `me-`, `start-`, `end-`) | First-class RTL |
| Primitives | **Radix UI** (Dialog, DropdownMenu, Popover, Select, Tabs, Tooltip, Switch, AlertDialog) + **lucide-react** icons | Accessible, unstyled, works in RTL with `dir="rtl"` |
| Motion | **motion** (framer-motion) | Smooth page/list/dialog transitions |
| Charts | **Recharts** | Simple bar/area/donut charts |
| Jalali dates | **date-fns-jalali** (all date math) | Correct Jalali month lengths, leap years, formatting |
| Date picker | Custom Jalali picker built on Radix Popover + date-fns-jalali | Fully on-brand; no locale glitches |
| Font | **Vazirmatn** via `@fontsource-variable/vazirmatn` (bundled, works offline) | Best modern Persian UI font |
| State/data | **Zustand** store + **tauri-plugin-sql (SQLite)** | Local, durable, queryable |
| OS integration | `tauri-plugin-notification` (due reminders), `tauri-plugin-dialog` + `tauri-plugin-fs` (backup export/import), `tauri-plugin-single-instance` | |
| Packaging | `tauri build` → NSIS installer (`.exe`), Persian-friendly | |

## 2. Localization rules (non-negotiable)

- `<html lang="fa" dir="rtl">`. Every layout must look correct in RTL; use logical Tailwind classes only (no `ml-`/`pl-`/`left-`).
- **All numbers shown in Persian digits** (۰-۹), via one helper `toFaDigits()`. Inputs accept both Persian/Arabic and Latin digits and normalize (`normalizeDigits()`).
- **Currency: تومان.** Stored as integer Toman (`INTEGER`, no floats). Displayed as `۱۲٬۵۰۰٬۰۰۰ تومان` (Persian thousands separator `٬`). Helper `formatToman(n)` and compact form `formatTomanCompact(n)` → `۱۲٫۵ میلیون`, `۳ میلیارد`.
- Money input component: live grouping as you type, plus a small caption under the field with the amount **in Persian words** (e.g. «دوازده میلیون و پانصد هزار تومان»), via a `numberToPersianWords()` helper. Quick-add chips: `+۱ میلیون`, `+۱۰ میلیون`.
- **Dates: Jalali only** in the UI. Stored in DB as ISO `YYYY-MM-DD` (Gregorian) for sorting/robustness; converted at the edges. Format examples: `۱۴۰۵/۰۸/۰۱`, long form `پنج‌شنبه ۱ آبان ۱۴۰۵`.
- Week starts **Saturday** (شنبه); Friday (جمعه) highlighted as the weekend in calendars.
- Relative labels: «امروز»، «فردا»، «۳ روز دیگر»، «۵ روز گذشته».

## 3. Domain model (SQLite)

```sql
plans (
  id INTEGER PK, title TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('payable','receivable')), -- بدهی من / طلب من
  counterparty TEXT,          -- bank / store / person name
  category TEXT,              -- وام بانکی، خرید قسطی، شخصی، ...
  total_amount INTEGER NOT NULL,   -- principal price in Toman
  down_payment INTEGER NOT NULL DEFAULT 0, -- پیش‌پرداخت
  profit_rate REAL NOT NULL DEFAULT 0,     -- annual % (سود/کارمزد), optional
  installment_count INTEGER NOT NULL,
  installment_amount INTEGER NOT NULL,     -- per installment (auto-calculated, user-overridable)
  start_date TEXT NOT NULL,                -- first due date (ISO)
  interval_type TEXT NOT NULL CHECK(interval_type IN ('monthly','weekly','days')),
  interval_value INTEGER NOT NULL DEFAULT 1, -- every N months/weeks/days
  color TEXT NOT NULL, icon TEXT NOT NULL,
  notes TEXT, archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
)

installments (
  id INTEGER PK, plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,            -- 1..n
  due_date TEXT NOT NULL,          -- ISO
  amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  paid_date TEXT,                  -- ISO
  note TEXT
)
settings (key TEXT PK, value TEXT)
```

Derived status per installment (computed, not stored): `paid` (paid_amount >= amount) · `partial` · `overdue` (unpaid & due_date < today) · `due-soon` (within reminder window) · `upcoming`.

### Schedule generation (`lib/schedule.ts`, pure + unit-tested)
- Monthly: add N **Jalali** months to the start date using date-fns-jalali `addMonths`; if the start day is 31 and the target month has 30/29 days, clamp to the last day, and keep the original day for later months (always compute from the start date, not from the previous item).
- Weekly / every-N-days: plain day arithmetic.
- Amounts: `financed = total - down_payment`. With profit rate r (annual %) and monthly interval, use the standard Iranian bank formula (amortized): `A = P·i·(1+i)^n / ((1+i)^n − 1)`, `i = r/1200`; with r = 0, `A = P/n`. Round to the nearest **1,000 Toman**; the rounding remainder goes onto the **last** installment so the sum is exact.
- Editing a plan that already has paid installments: regenerate only the unpaid ones and keep the paid ones as they are; confirm with the user first.

## 4. Screens & UX

App shell: a fixed **sidebar on the right** (RTL), collapsible, with the logo, nav items, a "+ قسط جدید" primary button, and a theme toggle at the bottom. Custom **frameless title bar** (Tauri `decorations: false`) with drag region and min/max/close buttons placed correctly for Windows. Window min size 1100×700.

1. **داشبورد (Dashboard)**
   - KPI cards: total remaining debt · paid this month / due this month · overdue (red, count + amount) · receivables remaining (if any).
   - "Next due" hero card: nearest unpaid installment with a big countdown, a one-click «پرداخت شد» button, and an undo toast.
   - Bar chart: amounts due per Jalali month for the next 12 months (stacked paid/unpaid), with Persian month names on the axis.
   - Upcoming 30 days list and an overdue list.
   - Donut: remaining amount by category.
2. **اقساط من (Plans)**: grid/list of plan cards: icon+color, title, counterparty, progress ring (paid/total count and %), remaining amount, next due date, badges. Search, filter (direction, category, status: active/finished/archived), and sorting.
3. **جزئیات قسط (Plan detail)**: header with stats and a progress bar. Timeline/table of all installments with status chips; row actions are mark paid (full/partial amount + Jalali paid date), undo payment, edit amount/date, and note. Bulk "mark selected as paid". Edit/archive/delete plan (AlertDialog confirm).
4. **ایجاد/ویرایش (Plan wizard)** in a large dialog or drawer, as 3 steps with a live preview panel:
   1) basics (title, direction, counterparty, category, icon/color picker)
   2) money (total, down payment, profit %, count, interval, first due date). The per-installment amount is auto-calculated with an override toggle.
   3) preview of the generated schedule table + totals (total payable, total profit), then save.
5. **تقویم (Calendar)**: full Jalali month grid (Sat→Fri) with colored dots/pills per due installment, prev/next/today buttons. Clicking a day opens a side panel with that day's installments and a quick mark-as-paid action.
6. **گزارش‌ها (Reports)**: per-year (Jalali) summary, paid vs. remaining per month, CSV export (UTF-8 BOM so Excel shows Persian).
7. **تنظیمات (Settings)**: theme (light/dark/system), reminder window (days before due, default 3), notifications on/off, launch reminder check, backup **export/import JSON**, clear all data (double confirm), about.

### Visual design
- Modern, sleek "glass + soft" look: neutral zinc base, **one accent (emerald/teal) for positive/primary**, rose for overdue, amber for due-soon, sky for receivables.
- Rounded-2xl cards, subtle borders + soft shadows, a light backdrop blur on the sidebar/title bar, generous spacing, and 14–15px base text.
- Full **dark mode**, using CSS variables for theme tokens.
- Micro-interactions: hover lift on cards, animated progress rings, a list stagger on mount, page fade/slide transitions, and a confetti-lite checkmark animation when a plan is fully paid.
- Empty states with an illustration-style icon and a clear CTA. Skeleton loaders. Toasts (sonner) in Persian, positioned bottom-left.
- Keyboard: `Ctrl+N` new plan, `Ctrl+K` command palette / quick search (cmdk), and `Esc` closes dialogs.

## 5. Reminders
- On app launch and every hour while open: query unpaid installments that are overdue or due within the reminder window, and send **one** grouped Windows notification (e.g. «۲ قسط تا ۳ روز آینده سررسید دارد — مجموع ۱۲٬۰۰۰٬۰۰۰ تومان»). Don't notify twice for the same set on the same day (store `last_notified` in settings).
- A badge with the overdue count on the sidebar nav item.

## 6. Project structure
```
src-tauri/            Tauri config, Rust main (plugins + SQL migrations), icons
src/
  main.tsx, App.tsx, router (react-router, hash router)
  lib/  digits.ts, money.ts, words.ts (number→Persian words), jalali.ts, schedule.ts, status.ts, db.ts, backup.ts, notify.ts
  store/ usePlans.ts, useSettings.ts (zustand)
  components/ ui/ (Button, Card, Input, MoneyInput, JalaliDatePicker, Dialog, Badge, ProgressRing, Select, ...), layout/ (TitleBar, Sidebar, Shell)
  pages/ Dashboard, Plans, PlanDetail, PlanWizard, Calendar, Reports, Settings
  styles/ index.css (tailwind, tokens, font)
tests/ vitest unit tests for lib/*
```

## 7. Implementation phases
1. **Scaffold**: Tauri 2 + Vite React TS, Tailwind v4, fonts, RTL, frameless window + title bar, plugins wired, SQLite migrations.
2. **Core libs + tests**: digits, money, words, jalali helpers, schedule generation (month-end clamping, rounding remainder, profit formula), and status. Use Vitest.
3. **Data layer**: db.ts CRUD and zustand stores.
4. **UI kit**: the components listed above, with light/dark support.
5. **Pages**: Plans + Wizard → Plan detail → Dashboard → Calendar → Reports → Settings.
6. **Reminders, backup/import, CSV export, command palette.**
7. **Polish**: animations, empty states, and an RTL audit (no visual LTR leaks) with seeded demo data available in dev only.
8. **Verify**: `npm run test`, `npx tsc --noEmit`, `npm run build`, `cargo check` and `npm run tauri build` all pass; the installer is produced in `src-tauri/target/release/bundle/nsis/`.

## 8. Acceptance criteria
- Creating a 12-month plan starting ۱۴۰۵/۰۶/۳۱ yields due dates ending on day 30 for months 7–11 and ۲۹/۳۰ for Esfand (depending on leap year), then returns to 31 where applicable.
- The sum of generated installments plus the down payment equals the expected payable total exactly.
- All UI text is Persian, all digits are Persian, and the layout is fully RTL. No Gregorian date appears anywhere in the UI.
- Data persists across restarts. Backup export → clear → import restores everything.
- The production installer builds and the app launches from it.
