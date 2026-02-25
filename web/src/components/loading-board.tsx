import { Skeleton } from "@/components/ui/skeleton";

export function LoadingBoard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/85 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="flex gap-4 overflow-hidden pb-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="w-[320px] shrink-0 rounded-2xl border border-slate-200/70 bg-white/85 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          >
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
