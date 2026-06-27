"use client";

import type { SessionUser } from "@arac/types";
import { useEffect, useRef, useState } from "react";

/**
 * Profile icon + dropdown. Client Component (needs open/close state, click-outside,
 * keyboard). Logout posts to the gateway, which clears the httpOnly session cookie;
 * because that cookie is the source of truth on the shared origin, logging out here
 * logs you out of every zone.
 *
 * For production, consider Radix UI `DropdownMenu` for full a11y (focus trap, arrow
 * keys); this is a lightweight accessible version.
 */
export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User menu"
        className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-black/10 text-sm font-semibold dark:bg-white/10"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="size-9 object-cover" />
        ) : (
          user.name.charAt(0).toUpperCase()
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-lg border border-black/10 bg-background p-1 shadow-lg dark:border-white/10"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-foreground/60">{user.email}</p>
          </div>
          <hr className="my-1 border-black/10 dark:border-white/10" />
          <a
            role="menuitem"
            href="/account"
            className="block rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            Settings
          </a>
          {/* hard POST to the gateway → clears cookie → logs out across all zones */}
          <form action="/api/auth/logout" method="post">
            <button
              role="menuitem"
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-black/5 dark:hover:bg-white/5"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
