import type { ReactNode } from "react";
import type { SessionUser } from "@arac/types";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { DEFAULT_NAV, type NavItem } from "./nav";

export interface AppShellProps {
  children: ReactNode;
  nav?: NavItem[];
  user?: SessionUser | null;
  logoSrc?: string;
}

// Shared application frame: Header + content + Footer. Each app's root layout
// renders <AppShell> so header/footer are authored once and reused everywhere.
export function AppShell({ children, nav = DEFAULT_NAV, user, logoSrc }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header nav={nav} user={user} logoSrc={logoSrc} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <Footer />
    </div>
  );
}
