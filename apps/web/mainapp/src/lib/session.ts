import { cookies } from "next/headers";
import type { SessionUser } from "@arac/types";

/**
 * Resolves the authenticated user for SSR. Runs only on the server: it reads the httpOnly
 * `arac_session` cookie (never exposed to client JS) and asks the gateway `/api/auth/me`,
 * which validates the token and returns the minimal SessionUser. The raw token never
 * reaches the browser, and only the minimal identity is surfaced (data minimization/GDPR).
 *
 * Returns null when signed out or the token is invalid/expired → the UI shows "Sign in".
 * Silent refresh of an expired access token happens in middleware (it can set cookies;
 * a Server Component render cannot).
 */
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

export async function getSession(): Promise<SessionUser | null> {
  const accessToken = (await cookies()).get("arac_session")?.value;
  if (!accessToken) return null;

  try {
    const res = await fetch(`${GATEWAY_URL}/api/auth/me`, {
      headers: { cookie: `arac_session=${accessToken}` },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as SessionUser) : null;
  } catch {
    // Gateway unreachable → treat as signed out (fail closed), never throw into render.
    return null;
  }
}
