import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROUTES } from "@/lib/routes";

const PUBLIC_PATHS = [
  ROUTES.LOGIN,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
];
const API_PUBLIC_PREFIX = "/api/auth/";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow API auth routes (login, forgot-password, reset-password, etc.)
  if (pathname.startsWith(API_PUBLIC_PREFIX)) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const token = request.cookies.get("admin_token")?.value;
    if (token && pathname === ROUTES.LOGIN) {
      return NextResponse.redirect(new URL(ROUTES.DASHBOARD, request.url));
    }
    return NextResponse.next();
  }

  // Protected routes: require auth
  const token = request.cookies.get("admin_token")?.value;
  if (!token) {
    const loginUrl = new URL(ROUTES.LOGIN, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
