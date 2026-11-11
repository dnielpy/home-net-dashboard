"use client";

import { type ReactNode, useState } from "react";

import { AppBar } from "@/components/layout/app-bar";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col">
      <AppBar onMenuClick={() => setSidebarOpen((open) => !open)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[#eef2fb] dark:bg-zinc-950">{children}</div>
      </div>
    </div>
  );
}
