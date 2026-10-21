# قسط‌یار (Ghest-Yar)

[![CI](https://github.com/Ali-Fani/ghest-yar/actions/workflows/ci.yml/badge.svg)](https://github.com/Ali-Fani/ghest-yar/actions/workflows/ci.yml)
[![Release](https://github.com/Ali-Fani/ghest-yar/actions/workflows/release.yml/badge.svg)](https://github.com/Ali-Fani/ghest-yar/actions/workflows/release.yml)

برنامه دسکتاپ ویندوز برای مدیریت اقساط، کاملاً فارسی و راست‌به‌چپ، با تقویم شمسی و واحد پول تومان.

## امکانات

- داشبورد: بدهی باقی‌مانده، پرداختی این ماه، معوقات، قسط بعدی با شمارش معکوس و پرداخت یک‌کلیکی (با امکان بازگردانی)، نمودار ۱۲ ماه آینده، نمودار دسته‌بندی
- اقساط من: کارت/لیست برنامه‌ها با جستجو، فیلتر و مرتب‌سازی
- جزئیات قسط: جدول اقساط، پرداخت کامل/جزئی، بازگردانی، ویرایش، پرداخت گروهی، بایگانی و حذف
- ویزارد ساخت/ویرایش در ۳ مرحله با پیش‌نمایش زنده (سود بانکی، گرد کردن به ۱۰۰۰ تومان، باقی‌مانده روی قسط آخر، کلمپ پایان ماه شمسی)
- تقویم شمسی (شنبه تا جمعه)، گزارش سالانه با خروجی CSV (UTF-8 BOM برای اکسل)
- تنظیمات: تم روشن/تیره/سیستم، بازه یادآوری، اعلان ویندوز، پشتیبان JSON (خروجی/ورودی)، پاک کردن داده‌ها
- میان‌برها: `Ctrl+N` قسط جدید، `Ctrl+K` جستجو و دستورها

## فناوری‌ها

Tauri 2 · React 19 · TypeScript · Vite · Tailwind CSS v4 · Radix UI · motion · Recharts · date-fns-jalali · Zustand · SQLite (`tauri-plugin-sql`) · Vazirmatn

## دستورات

```bash
npm install            # نصب وابستگی‌ها
npm run dev            # اجرای رابط در مرورگر (ذخیره‌سازی موقت localStorage، فقط برای توسعه)
npm run tauri dev      # اجرای برنامه دسکتاپ (SQLite واقعی)
npm run test           # آزمون‌های واحد (Vitest)
npx tsc --noEmit       # بررسی نوع‌ها
npm run build          # ساخت فرانت‌اند
cd src-tauri && cargo check
npm run tauri build    # ساخت نصب‌کننده NSIS
```

نصب‌کننده در `src-tauri/target/release/bundle/nsis/` ساخته می‌شود.

## انتشار نسخهٔ جدید

شمارهٔ نسخه فقط در `package.json` نگهداری می‌شود؛ `tauri.conf.json` از آن می‌خواند و `scripts/sync-version.mjs` فایل‌های `Cargo.toml` و `Cargo.lock` را همگام می‌کند.

1. ابتدا `CHANGELOG.md` را به‌روز کنید و تغییرات را کامیت کنید (درخت git باید تمیز باشد).
2. نسخه را افزایش دهید: `npm run release:patch` (یا `release:minor` / `release:major`). این دستور همهٔ فایل‌ها را به‌روز می‌کند، کامیت می‌سازد و برچسب `vX.Y.Z` را می‌زند.
3. نصب‌کننده را بسازید: `npm run tauri build`
4. فایل نصب‌کننده: `src-tauri/target/release/bundle/nsis/قسط‌یار_<version>_x64-setup.exe` (در GitHub Releases: `GhestYar_<version>_x64-setup.exe`)

### انتشار خودکار با GitHub Actions

به‌جای ساخت دستی، پس از `npm run release:patch` کافی است `git push --follow-tags` بزنید. گردش‌کار `.github/workflows/release.yml` با برچسب `vX.Y.Z` اجرا می‌شود، آزمون‌ها و بررسی نوع را انجام می‌دهد، تطابق برچسب با نسخهٔ `package.json` را می‌سنجد، نصب‌کنندهٔ NSIS را می‌سازد و با متن همان نسخه از `CHANGELOG.md` در GitHub Release منتشر می‌کند. گردش‌کار `ci.yml` روی هر push و pull request آزمون‌ها و ساخت را بررسی می‌کند. 

نصب نسخهٔ جدید روی نسخهٔ قبلی، داده‌های کاربر را حفظ می‌کند. مایگریشن‌های پایگاه داده (`src-tauri/src/lib.rs`) نسخه‌دار و **فقط افزایشی** هستند: هر تغییر در ساختار جدول‌ها باید یک مایگریشن جدید با شمارهٔ بعدی باشد و مایگریشن‌های قبلی هرگز ویرایش نشوند.

پیش‌نیازها: Node 20+، Rust (MSVC)، Visual Studio Build Tools، و WebView2 (در ویندوز ۱۱ نصب است).

## نکات

- تاریخ‌ها در پایگاه داده به‌صورت میلادی ISO ذخیره و فقط هنگام نمایش به شمسی تبدیل می‌شوند؛ مبالغ به‌صورت عدد صحیح تومان.
- فایل CSV مبالغ را به‌صورت عدد لاتین (برای جمع‌زدن در اکسل) و تاریخ‌ها را شمسی فارسی ذخیره می‌کند.
- «داده نمایشی» فقط در حالت توسعه (`npm run dev` / `tauri dev`) در تنظیمات و داشبورد خالی دیده می‌شود.

### به‌روزرسانی خودکار و کلیدها

برنامه از `https://github.com/Ali-Fani/ghest-yar/releases/latest/download/latest.json` نسخهٔ جدید را بررسی می‌کند (فقط انتشارهای غیر پیش‌انتشار). بسته‌ها با کلید خصوصی Tauri امضا و با کلید عمومی داخل `tauri.conf.json` (`plugins.updater.pubkey`) راستی‌آزمایی می‌شوند.

- کلید خصوصی و گذرواژه‌اش هرگز در مخزن قرار نمی‌گیرد؛ در GitHub Secrets با نام‌های `TAURI_SIGNING_PRIVATE_KEY` و `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` ذخیره شده‌اند.
- ساخت محلی نصب‌کننده هم به همین دو متغیر محیطی نیاز دارد (چون `createUpdaterArtifacts` روشن است).
- **تعویض کلید:** `npm run tauri signer generate -- -w ~/.tauri/ghestyar.key` را اجرا کنید، کلید عمومی جدید را در `plugins.updater.pubkey` بگذارید و secretها را به‌روز کنید. توجه: نسخه‌های نصب‌شده با کلید قدیمی، به‌روزرسانی امضاشده با کلید جدید را نمی‌پذیرند؛ برای عبور از تعویض کلید، یک نسخهٔ واسط با کلید قدیمی که کلید عمومی جدید را در خود دارد منتشر کنید، یا کاربران را به نصب دستی هدایت کنید.

---

## English (short)

**Ghest-Yar** is a Windows desktop installments tracker (Persian, RTL, Jalali calendar, Toman). Built with Tauri 2 + React 19 + TypeScript + Tailwind v4, data stored locally in SQLite.

```bash
npm install
npm run dev          # browser UI (localStorage fallback, dev only)
npm run tauri dev    # desktop app
npm run test         # Vitest unit tests for src/lib
npx tsc --noEmit
npm run build
cd src-tauri && cargo check
npm run tauri build  # NSIS installer -> src-tauri/target/release/bundle/nsis/
```

### Releasing

`package.json` is the single source of truth for the version (`tauri.conf.json` reads it; `scripts/sync-version.mjs` syncs `Cargo.toml` and `Cargo.lock`).

1. Update `CHANGELOG.md` and commit (working tree must be clean).
2. `npm run release:patch` (or `release:minor` / `release:major`): bumps all files, commits, and creates the `vX.Y.Z` tag.
3. `npm run tauri build`
4. Installer: `src-tauri/target/release/bundle/nsis/قسط‌یار_<version>_x64-setup.exe` (on GitHub Releases: `GhestYar_<version>_x64-setup.exe`)

### Automated release (GitHub Actions)

After `npm run release:patch`, run `git push --follow-tags`. The `release.yml` workflow runs on the `vX.Y.Z` tag: tests + type check, a guard that the tag equals the `package.json` version, builds the NSIS installer and publishes a GitHub Release using that version's section of `CHANGELOG.md`. `ci.yml` runs tests and build checks on every push and pull request.

Database schema changes must always be **new** `tauri-plugin-sql` migrations with the next `version` number (see `src-tauri/src/lib.rs`), never edits to existing ones, so upgrades keep user data.

### Auto-update and keys

The app checks `https://github.com/Ali-Fani/ghest-yar/releases/latest/download/latest.json` (non-prereleases only): silently ~5 s after launch and every 6 h, with a Persian update card (release notes, progress, relaunch), a "Check for updates" button in Settings → About, and an auto-check toggle. Bundles are signed with the Tauri updater key and verified against `plugins.updater.pubkey` in `tauri.conf.json`.

- The private key and its password never live in the repo; they are GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Local `npm run tauri build` needs the same two env vars (`createUpdaterArtifacts` is on).
- **Rotating keys:** run `npm run tauri signer generate -- -w ~/.tauri/ghestyar.key`, put the new public key in `plugins.updater.pubkey`, update the secrets. Installed apps only trust the old key, so ship one bridge release signed with the OLD key that embeds the NEW pubkey (or ask users to reinstall manually).
