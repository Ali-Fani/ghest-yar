const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", "هزار", "میلیون", "میلیارد", "تریلیون", "کوادریلیون"];

function below1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 20) parts.push(ONES[r]);
    else {
      const t = Math.floor(r / 10);
      const o = r % 10;
      parts.push(o ? `${TENS[t]} و ${ONES[o]}` : TENS[t]);
    }
  }
  return parts.join(" و ");
}

/** Convert an integer to Persian words. */
export function numberToPersianWords(n: number): string {
  if (!Number.isFinite(n)) return "";
  n = Math.trunc(n);
  if (n === 0) return "صفر";
  const neg = n < 0;
  n = Math.abs(n);
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    const words = below1000(g);
    parts.push(i === 0 ? words : i === 1 && g === 1 ? "یک هزار" : `${words} ${SCALES[i]}`);
  }
  return (neg ? "منفی " : "") + parts.join(" و ");
}

/** «دوازده میلیون و پانصد هزار تومان» */
export function tomanInWords(n: number): string {
  if (!n) return "";
  return `${numberToPersianWords(n)} تومان`;
}
