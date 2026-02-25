import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  isSubmitting = false,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  const iconClassName =
    tone === "destructive"
      ? "bg-red-100 text-red-600 ring-1 ring-red-200"
      : "bg-slate-100 text-slate-700 ring-1 ring-slate-200";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full ${iconClassName}`}>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "destructive" ? "destructive" : "default"} onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
