import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware that keeps the SSR session healthy and gates protected routes:
 *
 *  - Silent refresh: if the short-lived access token is missing/expired but a refresh
 *    cookie is present, it rotates at the gateway and sets the new httpOnly cookies on the
 *    response — so a logged-in user is never bounced just because 15 minutes passed.
 *  - Protection: any non-public route without a session redirects to /login.
 *
 * Tokens are only ever read from / written to httpOnly cookies here — nothing is exposed
 * to client JS (no-leak / GDPR).
 */
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";
const SECURE_COOKIES = process.env.NODE_ENV === "production";
const PUBLIC_PATHS = ["/login", "/signup"];

/** True if the JWT is absent or within 5s of expiry (decode only — never trust, just route). */
function accessExpired(jwt?: string): boolean {
  if (!jwt) return true;
  try {
    const payload = jwt.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp !== "number" || json.exp * 1000 <= Date.now() + 5000;
  } catch {
    return true;
  }
}

function applySetCookies(res: NextResponse, setCookies: string[]): void {
  for (const raw of setCookies) {
    const [pair, ...attrs] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    let path = "/";
    let maxAge: number | undefined;
    for (const attr of attrs) {
      const [k, v] = attr.split("=");
      const key = k.trim().toLowerCase();
      if (key === "path") path = v?.trim() || "/";
      else if (key === "max-age") maxAge = Number(v?.trim());
    }
    res.cookies.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: SECURE_COOKIES,
      path,
      maxAge,
    });
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const access = req.cookies.get("arac_session")?.value;
  const refresh = req.cookies.get("arac_refresh")?.value;

  let hasSession = !accessExpired(access);
  let refreshed: NextResponse | null = null;

  if (!hasSession && refresh) {
    const upstream = await fetch(`${GATEWAY_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { cookie: `arac_refresh=${refresh}` },
      cache: "no-store",
    }).catch(() => null);
    if (upstream?.ok) {
      refreshed = NextResponse.next();
      applySetCookies(refreshed, upstream.headers.getSetCookie());
      hasSession = true;
    }
  }

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return refreshed ?? NextResponse.next();
}

// Run on app routes only — skip API (handled explicitly), Next internals, and static files.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
