export const CATEGORIES = ["وام بانکی", "خرید قسطی", "خودرو", "مسکن", "تحصیل", "درمان", "شخصی", "سایر"];

export const PLAN_COLORS = ["#10b981", "#14b8a6", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#f43f5e", "#f59e0b", "#84cc16", "#64748b"];

export const PLAN_ICONS = ["wallet", "home", "car", "landmark", "smartphone", "laptop", "graduation", "heart", "shopping", "sofa", "plane", "briefcase", "user", "gift"] as const;
export type PlanIconName = (typeof PLAN_ICONS)[number];

export const INTERVAL_LABEL = { monthly: "ماهانه", weekly: "هفتگی", days: "هر چند روز" } as const;
export const DIRECTION_LABEL = { payable: "بدهی من", receivable: "طلب من" } as const;
