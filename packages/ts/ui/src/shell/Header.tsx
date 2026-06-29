import type { SessionUser } from "@arac/types";
import { Logo } from "../atomic/Logo";
import { ThemeToggle } from "../theme/ThemeToggle";
import { UserMenu } from "./UserMenu";
import { DEFAULT_NAV, type NavItem } from "./nav";

// Default brand logo (override via `logoSrc`).
const DEFAULT_LOGO =
  "https://res.cloudinary.com/dw58hubkc/image/upload/v1782546357/Screenshot_2026-06-27_at_1.15.24_PM_tlynbm.png";

export interface HeaderProps {
  nav?: NavItem[];
  /** verified user, or null when signed out */
  user?: SessionUser | null;
  logoSrc?: string;
}

// Shared app header. Server Component; embeds the client ThemeToggle + UserMenu.
// Nav links are plain <a> (cross-zone = hard navigation in Multi-Zones).
export function Header({ nav = DEFAULT_NAV, user, logoSrc = DEFAULT_LOGO }: HeaderProps) {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <a href="/" aria-label="Home" className="flex items-center">
          <Logo size={32} src={logoSrc} className="rounded" />
        </a>

        <nav className="flex items-center gap-4 text-sm">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="text-foreground/80 hover:text-foreground">
              {item.label}
            </a>
          ))}
          {/* Admin link only for users who may manage others (from the verified session). */}
          {user?.canManageUsers ? (
            <a href="/admin/users" className="text-foreground/80 hover:text-foreground">
              Admin
            </a>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <a
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
