import * as React from "react";

import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback: string;
}

export function Avatar({ src, alt, fallback, className, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200",
        className,
      )}
      {...props}
    >
      {src ? <img className="h-full w-full object-cover" src={src} alt={alt ?? "User avatar"} /> : null}
      <span className={cn(src ? "absolute inset-0 hidden items-center justify-center" : "")}>{fallback}</span>
    </div>
  );
}
