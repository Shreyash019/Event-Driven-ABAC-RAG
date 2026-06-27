import { cookies } from "next/headers";
import type { SessionUser } from "@arac/types";

/**
 * Reads the authenticated user for SSR. The httpOnly session cookie (set behind
 * the gateway) is the single source of truth — both zones read the same cookie on
 * the shared origin, so the header shows a consistent login state everywhere.
 *
 * TODO: replace the stub with a real verification — either decode/verify the JWT,
 * or fetch `/api/auth/me` through the gateway with the incoming cookie. Until the
 * auth flow exists, this returns null (signed-out → header shows "Sign in").
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get("arac_session")?.value;
  if (!token) return null;

  // const res = await fetch(`${process.env.GATEWAY_URL}/api/auth/me`, {
  //   headers: { cookie: `arac_session=${token}` }, cache: "no-store",
  // });
  // return res.ok ? ((await res.json()) as SessionUser) : null;
  return null;
}
