import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { ADMIN_COOKIE } from "@/lib/admin-session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ------------------------------------------------------------------
  // /play — requires a player session cookie (DB validation happens
  //         in the page server component itself)
  // ------------------------------------------------------------------
  if (pathname.startsWith("/play")) {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ------------------------------------------------------------------
  // /admin — requires the admin key cookie (set by /admin/login)
  // Skip /admin/login itself so we don't loop
  // ------------------------------------------------------------------
  if (
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login")
  ) {
    const adminKey = request.cookies.get(ADMIN_COOKIE)?.value;
    const isValid =
      !!adminKey &&
      !!process.env.ADMIN_KEY &&
      adminKey === process.env.ADMIN_KEY;

    if (!isValid) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/play/:path*", "/admin/:path*"],
};
