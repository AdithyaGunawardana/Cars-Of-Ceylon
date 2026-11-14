import { NextResponse, type NextRequest } from "next/server";

// Block cross-site state-changing API calls. Native mobile clients send no Origin header and pass through.
// NextAuth endpoints (callback, signin, signout, session, csrf, ...) have their own CSRF token and are excluded.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function proxy(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.next();
  }

  const allowedHosts = new Set<string>();
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) allowedHosts.add(host);
  if (process.env.AUTH_URL) {
    try {
      allowedHosts.add(new URL(process.env.AUTH_URL).host);
    } catch {
      // Ignore malformed AUTH_URL; host header check above still applies.
    }
  }

  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }

  if (!originHost || !allowedHosts.has(originHost)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  // Only NextAuth's own routes are exempt; our /api/auth/register, /password/* and /verify/* endpoints are guarded.
  matcher: ["/api/((?!auth/(?:callback|signin|signout|session|csrf|providers|error|_log)).*)"],
};
