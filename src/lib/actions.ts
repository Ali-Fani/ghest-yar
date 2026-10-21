import { toast } from "sonner";
import { usePlans } from "../store/usePlans";
import { useUI } from "../store/useUI";

/** One-click "paid" with undo toast and a celebration when the plan is finished. */
export async function quickPay(id: number, label = "قسط پرداخت شد") {
  const { planFinished, prev } = await usePlans.getState().payFull(id);
  toast.success(label, {
    duration: 6000,
    action: { label: "بازگردانی", onClick: () => void usePlans.getState().restorePayment(id, prev) },
  });
  if (planFinished) useUI.getState().celebrate(true);
}
