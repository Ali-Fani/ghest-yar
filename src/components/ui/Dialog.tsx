import { AlertDialog, Dialog as RDialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  side,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** "start" renders as a drawer that slides from the start (right in RTL) edge. */
  side?: "start";
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </RDialog.Overlay>
            <RDialog.Content asChild aria-describedby={undefined}>
              <motion.div
                className={cn(
                  "fixed z-50 flex flex-col overflow-hidden border border-line bg-surface shadow-pop outline-none",
                  side === "start"
                    ? "inset-y-0 start-0 w-[min(440px,100vw)] border-y-0 border-s-0"
                    : "inset-0 m-auto h-fit max-h-[90vh] w-[min(560px,94vw)] rounded-3xl",
                  className,
                )}
                initial={side === "start" ? { x: "100%", opacity: 0.6 } : { opacity: 0, scale: 0.96, y: 8 }}
                animate={side === "start" ? { x: 0, opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={side === "start" ? { x: "100%", opacity: 0 } : { opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                  <div>
                    <RDialog.Title className="text-base font-bold">{title}</RDialog.Title>
                    {description && <RDialog.Description className="mt-0.5 text-[13px] text-muted">{description}</RDialog.Description>}
                  </div>
                  <RDialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="بستن">
                      <X size={18} />
                    </Button>
                  </RDialog.Close>
                </div>
                {children}
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[3px] data-[state=open]:animate-[pop-in_0.15s]" />
        <AlertDialog.Content className="pop-anim fixed inset-0 z-[60] m-auto h-fit w-[min(420px,92vw)] rounded-3xl border border-line bg-surface p-6 shadow-pop outline-none">
          <AlertDialog.Title className="text-base font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[13.5px] leading-7 text-muted">{description}</AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={danger ? "danger" : "primary"}
                className={danger ? "bg-danger text-white hover:brightness-110" : ""}
                onClick={() => void onConfirm()}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
