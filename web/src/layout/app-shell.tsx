import type { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#f6f9ff_0%,_#eef2f8_52%,_#edf0f5_100%)] text-slate-700">
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200/60 bg-white/60 px-4 py-6 backdrop-blur-sm md:block">{sidebar}</aside>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-200/60 bg-white/70 px-4 py-3 backdrop-blur-sm md:px-6">{header}</header>
          <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
