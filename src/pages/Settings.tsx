import { useState } from "react";
import { toast } from "sonner";
import { Bell, Database, Download, Info, Monitor, Moon, Palette, Sparkles, Sun, Trash2, Upload } from "lucide-react";
import { useSettings, type Theme } from "../store/useSettings";
import { usePlans } from "../store/usePlans";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/Dialog";
import { NumInput } from "../components/ui/Input";
import { PageHeader, Segmented, Switch } from "../components/ui/Misc";
import { Logo } from "../components/layout/Logo";
import { backupFileName, readTextFileViaDialog, saveTextFile, validateBackup } from "../lib/backup";
import { checkReminders, buildReminder } from "../lib/notify";
import { toFaDigits } from "../lib/digits";
import { seedDemo } from "../lib/seed";

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-5 p-6">
      <div className="mb-4 flex items-center gap-2.5 text-[15px] font-bold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">{icon}</span>
        {title}
      </div>
      <div className="flex flex-col divide-y divide-line">{children}</div>
    </Card>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div>
        <div className="text-[14px] font-medium">{title}</div>
        {desc && <div className="mt-0.5 text-[13px] text-muted">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const s = useSettings();
  const { plans, exportData, importData, clearAll } = usePlans();
  const [clear1, setClear1] = useState(false);
  const [clear2, setClear2] = useState(false);
  const [importing, setImporting] = useState<ReturnType<typeof validateBackup> | null>(null);

  const doExport = async () => {
    const json = JSON.stringify(exportData(), null, 2);
    const ok = await saveTextFile(backupFileName(), json, "json", "پشتیبان قسط‌یار");
    if (ok) toast.success("پشتیبان ذخیره شد");
  };

  const pickImport = async () => {
    try {
      const text = await readTextFileViaDialog("json", "پشتیبان قسط‌یار");
      if (!text) return;
      setImporting(validateBackup(JSON.parse(text)));
    } catch {
      toast.error("فایل پشتیبان معتبر نیست");
    }
  };

  const testNotify = async () => {
    if (!buildReminder()) {
      toast("قسطی برای یادآوری وجود ندارد", { description: "هیچ قسط معوق یا نزدیک به سررسیدی پیدا نشد." });
      return;
    }
    const sent = await checkReminders(true);
    toast(sent ? "اعلان ارسال شد" : "ارسال اعلان ممکن نبود (دسترسی اعلان یا محیط مرورگر)");
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="تنظیمات" subtitle="ظاهر، یادآوری‌ها و پشتیبان‌گیری" />

      <Section icon={<Palette size={17} />} title="ظاهر">
        <Row title="تم برنامه" desc="روشن، تیره یا هماهنگ با ویندوز">
          <Segmented<Theme>
            value={s.theme}
            onChange={(v) => void s.set("theme", v)}
            options={[
              { value: "light", label: <><Sun size={15} /> روشن</> },
              { value: "dark", label: <><Moon size={15} /> تیره</> },
              { value: "system", label: <><Monitor size={15} /> سیستم</> },
            ]}
          />
        </Row>
      </Section>

      <Section icon={<Bell size={17} />} title="یادآوری‌ها">
        <Row title="اعلان‌های ویندوز" desc="یک اعلان گروهی برای اقساط معوق و نزدیک به سررسید">
          <Switch checked={s.notifications} onCheckedChange={(v) => void s.set("notifications", v)} />
        </Row>
        <Row title="بررسی یادآوری هنگام اجرا" desc="با باز شدن برنامه و سپس هر ساعت بررسی می‌شود">
          <Switch checked={s.launchCheck} onCheckedChange={(v) => void s.set("launchCheck", v)} />
        </Row>
        <Row title="بازه یادآوری" desc="چند روز قبل از سررسید یادآوری شود (پیش‌فرض ۳ روز)">
          <div className="w-32">
            <NumInput
              value={String(s.reminderDays)}
              suffix="روز"
              onChange={(v) => void s.set("reminderDays", Math.min(60, Number(v || 0)))}
            />
          </div>
        </Row>
        <Row title="آزمایش اعلان" desc="همین حالا یک اعلان نمونه بر اساس اقساط فعلی ارسال می‌شود">
          <Button variant="secondary" onClick={() => void testNotify()}>
            <Bell size={16} /> ارسال اعلان
          </Button>
        </Row>
      </Section>

      <Section icon={<Database size={17} />} title="داده‌ها و پشتیبان‌گیری">
        <Row title="خروجی پشتیبان (JSON)" desc={`${toFaDigits(plans.length)} قسط در فایل ذخیره می‌شود`}>
          <Button variant="secondary" onClick={() => void doExport()}>
            <Download size={16} /> خروجی گرفتن
          </Button>
        </Row>
        <Row title="بازیابی از پشتیبان" desc="اطلاعات فعلی با محتوای فایل جایگزین می‌شود">
          <Button variant="secondary" onClick={() => void pickImport()}>
            <Upload size={16} /> وارد کردن
          </Button>
        </Row>
        <Row title="پاک کردن همه داده‌ها" desc="همه اقساط، پرداخت‌ها و تنظیمات حذف می‌شود">
          <Button variant="danger" onClick={() => setClear1(true)}>
            <Trash2 size={16} /> پاک کردن
          </Button>
        </Row>
        {import.meta.env.DEV && (
          <Row title="داده نمایشی (فقط توسعه)" desc="چند قسط نمونه برای آزمایش رابط اضافه می‌کند">
            <Button variant="soft" onClick={() => void seedDemo().then(() => toast.success("داده نمایشی اضافه شد"))}>
              <Sparkles size={16} /> افزودن
            </Button>
          </Row>
        )}
      </Section>

      <Section icon={<Info size={17} />} title="درباره">
        <div className="flex items-center gap-4">
          <Logo size={52} />
          <div>
            <div className="text-[16px] font-extrabold">قسط‌یار</div>
            <div className="text-[13px] text-muted">نسخه {toFaDigits("1.0.0")} · مدیریت اقساط با تقویم شمسی و تومان</div>
            <div className="text-xs text-muted">همه داده‌ها فقط روی همین رایانه ذخیره می‌شود.</div>
          </div>
        </div>
      </Section>

      <ConfirmDialog
        open={!!importing}
        onOpenChange={(o) => !o && setImporting(null)}
        title="بازیابی از پشتیبان؟"
        description={importing ? `${toFaDigits(importing.plans.length)} قسط و ${toFaDigits(importing.installments.length)} ردیف پرداخت وارد می‌شود و اطلاعات فعلی شما جایگزین خواهد شد.` : ""}
        confirmLabel="بازیابی"
        onConfirm={async () => {
          if (!importing) return;
          await importData(importing);
          setImporting(null);
          toast.success("اطلاعات بازیابی شد");
        }}
      />
      <ConfirmDialog
        open={clear1}
        onOpenChange={setClear1}
        danger
        title="پاک کردن همه داده‌ها؟"
        description="همه اقساط و پرداخت‌های شما حذف می‌شود. پیشنهاد می‌کنیم قبل از ادامه یک پشتیبان بگیرید."
        confirmLabel="ادامه"
        onConfirm={() => { setTimeout(() => setClear2(true), 150); }}
      />
      <ConfirmDialog
        open={clear2}
        onOpenChange={setClear2}
        danger
        title="تأیید نهایی"
        description="این کار غیرقابل بازگشت است. آیا کاملاً مطمئن هستید؟"
        confirmLabel="بله، همه چیز را پاک کن"
        onConfirm={async () => {
          await clearAll();
          toast.success("همه داده‌ها پاک شد");
        }}
      />
    </div>
  );
}
