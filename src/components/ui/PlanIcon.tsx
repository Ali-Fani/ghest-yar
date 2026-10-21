import {
  Briefcase, Car, Gift, GraduationCap, HeartPulse, Home, Landmark, Laptop, Plane, ShoppingBag, Smartphone, Sofa, User, Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";

export const ICON_MAP: Record<string, LucideIcon> = {
  wallet: Wallet, home: Home, car: Car, landmark: Landmark, smartphone: Smartphone, laptop: Laptop, graduation: GraduationCap,
  heart: HeartPulse, shopping: ShoppingBag, sofa: Sofa, plane: Plane, briefcase: Briefcase, user: User, gift: Gift,
};

export function PlanIcon({ icon, color, size = 44, className }: { icon: string; color: string; size?: number; className?: string }) {
  const I = ICON_MAP[icon] ?? Wallet;
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-2xl", className)}
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      <I size={size * 0.5} strokeWidth={2} />
    </div>
  );
}
