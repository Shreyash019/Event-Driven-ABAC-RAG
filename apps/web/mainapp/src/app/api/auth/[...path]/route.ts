import { NextResponse, type NextRequest } from "next/server";

/**
 * BFF auth proxy. The browser calls /api/auth/* on this origin (so httpOnly cookies are
 * sent automatically and never exposed to JS); this handler forwards to the gateway and
 * copies Set-Cookie back, binding the cookies to localhost:3000. One catch-all covers
 * login, refresh, logout, logout-all, and me — see loc-doc/AuthService.md §1.2.
 *
 * The browser never talks to the gateway or auth-service directly (zero-trust boundary).
 */

// Server-side only; reachable from the Next dev/server runtime.
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

// Only these incoming headers are forwarded upstream.
const FORWARD_REQUEST_HEADERS = ["content-type", "cookie", "authorization"];

/**
 * CSRF defense: on state-changing requests, require the Origin header to match this app's
 * own origin. The httpOnly auth cookies are only ever auto-sent to this origin, so a
 * cross-site page cannot forge a credentialed mutation. Requests without an Origin (non-
 * browser clients) carry no ambient cookies to abuse, so they pass.
 */
function sameOriginOrSafe(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  return !origin || origin === req.nextUrl.origin;
}

async function proxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  if (!sameOriginOrSafe(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }
  const target = `${GATEWAY_URL}/api/auth/${segments.join("/")}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });

  const out = new NextResponse(await upstream.text(), {
    status: upstream.status,
  });
  const contentType = upstream.headers.get("content-type");
  if (contentType) out.headers.set("content-type", contentType);
  // Re-emit each Set-Cookie so the browser stores them against this origin.
  for (const cookie of upstream.headers.getSetCookie()) {
    out.headers.append("set-cookie", cookie);
  }
  return out;
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  return proxy(req, (await ctx.params).path);
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  return proxy(req, (await ctx.params).path);
}
