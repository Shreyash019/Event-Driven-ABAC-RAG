"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Server Actions for the auth flow. These run ONLY on the server: credentials and tokens
 * never pass through client JS. login() forwards to the gateway, copies the resulting
 * httpOnly cookies onto this origin, and redirects; logout() revokes the session and
 * clears the cookies. The browser is left with nothing but httpOnly cookies (no token in
 * any JS-readable place) — the no-leak / GDPR posture the rest of the flow relies on.
 */

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";
const SECURE_COOKIES = process.env.NODE_ENV === "production";

type ParsedCookie = { name: string; value: string; path?: string; maxAge?: number };

function parseSetCookie(raw: string): ParsedCookie | null {
  const [pair, ...attrs] = raw.split(";");
  const eq = pair.indexOf("=");
  if (eq === -1) return null;
  const parsed: ParsedCookie = {
    name: pair.slice(0, eq).trim(),
    value: pair.slice(eq + 1).trim(),
  };
  for (const attr of attrs) {
    const [k, v] = attr.split("=");
    const key = k.trim().toLowerCase();
    if (key === "path") parsed.path = v?.trim();
    else if (key === "max-age") parsed.maxAge = Number(v?.trim());
  }
  return parsed;
}

async function applyUpstreamCookies(res: Response): Promise<void> {
  const jar = await cookies();
  for (const raw of res.headers.getSetCookie()) {
    const c = parseSetCookie(raw);
    if (!c) continue;
    jar.set(c.name, c.value, {
      httpOnly: true,
      secure: SECURE_COOKIES,
      sameSite: "lax",
      path: c.path ?? "/",
      maxAge: c.maxAge,
    });
  }
}

export async function login(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    // Generic message — no signal whether the email or the password was wrong.
    return { error: "Invalid email or password" };
  }

  await applyUpstreamCookies(res);
  redirect("/");
}

export async function signup(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");

  const res = await fetch(`${GATEWAY_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, name, password }),
    cache: "no-store",
  });

  if (res.status === 409) {
    return { error: "An account with this email already exists." };
  }
  if (!res.ok) {
    return {
      error: "Could not create account. Use a valid email and a password of at least 8 characters.",
    };
  }

  await applyUpstreamCookies(res); // auto-login the new account
  redirect("/");
}

export async function changePassword(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  const jar = await cookies();
  const res = await fetch(`${GATEWAY_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: jar.toString() },
    body: JSON.stringify({ currentPassword, newPassword }),
    cache: "no-store",
  });

  if (res.status === 401) return { error: "Current password is incorrect." };
  if (!res.ok) {
    return { error: "Could not update password. New password must be at least 8 characters." };
  }

  await applyUpstreamCookies(res); // server was revoked + re-issued; refresh our cookies
  return { success: true };
}

export async function requestPasswordReset(
  _prevState: { sent?: boolean } | undefined,
  formData: FormData,
): Promise<{ sent?: boolean }> {
  const email = String(formData.get("email") ?? "");
  await fetch(`${GATEWAY_URL}/api/auth/forgot`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  }).catch(() => undefined);
  // Always report "sent" regardless of outcome — never reveal whether the email exists.
  return { sent: true };
}

export async function resetPassword(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const res = await fetch(`${GATEWAY_URL}/api/auth/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
    cache: "no-store",
  });
  if (!res.ok) return { error: "This reset link is invalid or expired." };
  redirect("/login");
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  // Revoke the session server-side (best-effort), then clear cookies regardless.
  await fetch(`${GATEWAY_URL}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: jar.toString() },
    cache: "no-store",
  }).catch(() => undefined);

  jar.delete({ name: "arac_session", path: "/" });
  jar.delete({ name: "arac_refresh", path: "/api/auth" });
  redirect("/login");
}
