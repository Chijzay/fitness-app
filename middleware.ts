import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/register");

  // NextAuth v5 session cookie names
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token") ||
    req.cookies.has("next-auth.session-token") ||
    req.cookies.has("__Secure-next-auth.session-token");

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
