import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Logout endpoint for the shell's "Sign out" form (a native POST, no client JS).
 * Revokes the session at the gateway, clears the httpOnly cookies, and 303-redirects to
 * /login so the browser ends up on a page (not raw JSON). More specific than the catch-all
 * /api/auth/[...path] proxy, so it handles /api/auth/logout.
 */
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const jar = await cookies();
  await fetch(`${GATEWAY_URL}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: jar.toString() },
    cache: "no-store",
  }).catch(() => undefined);

  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.set("arac_session", "", { path: "/", maxAge: 0, httpOnly: true });
  res.cookies.set("arac_refresh", "", { path: "/api/auth", maxAge: 0, httpOnly: true });
  return res;
}
