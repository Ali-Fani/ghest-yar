# قسط‌یار (Ghest-Yar)

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

پیش‌نیازها: Node 20+، Rust (MSVC)، Visual Studio Build Tools، و WebView2 (در ویندوز ۱۱ نصب است).

## نکات

- تاریخ‌ها در پایگاه داده به‌صورت میلادی ISO ذخیره و فقط هنگام نمایش به شمسی تبدیل می‌شوند؛ مبالغ به‌صورت عدد صحیح تومان.
- فایل CSV مبالغ را به‌صورت عدد لاتین (برای جمع‌زدن در اکسل) و تاریخ‌ها را شمسی فارسی ذخیره می‌کند.
- «داده نمایشی» فقط در حالت توسعه (`npm run dev` / `tauri dev`) در تنظیمات و داشبورد خالی دیده می‌شود.

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
