import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title: string;
  description: string;
  onRetry: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionPending?: boolean;
}

export function ErrorState({
  title,
  description,
  onRetry,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionPending = false,
}: ErrorStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-red-100 bg-white/85 p-8 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <div className="mb-3 rounded-full bg-red-50 p-2 text-red-500">
        <AlertCircle className="h-4 w-4" />
      </div>
      <h2 className="text-base font-semibold text-slate-700">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-4 flex items-center gap-2">
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
        {secondaryActionLabel && onSecondaryAction ? (
          <Button onClick={onSecondaryAction} disabled={secondaryActionPending}>
            {secondaryActionPending ? "Creating..." : secondaryActionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
