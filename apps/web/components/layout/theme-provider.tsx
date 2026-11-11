"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

const clientScriptProps = typeof window === "undefined" ? undefined : { type: "application/json" };

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={clientScriptProps}
    >
      {children}
    </NextThemesProvider>
  );
}
