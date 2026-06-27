"use client";
import { ThemeProvider as NextThemes, type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemes
      attribute="class"          // toggles <html class="dark">
      defaultTheme="system"
      enableSystem
      storageKey="arac-theme"    // SAME key in both apps → cross-zone sync
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemes>
  );
}