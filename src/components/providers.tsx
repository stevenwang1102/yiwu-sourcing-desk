"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/storage";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <StoreProvider>
          {children}
          <Toaster position="top-center" />
        </StoreProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
