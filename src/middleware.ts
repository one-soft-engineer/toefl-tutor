import { NextResponse } from "next/server";
import { auth } from "@/auth";

// In local authoring mode there is no auth secret configured, so the request
// must NOT pass through the NextAuth `auth()` wrapper at all (it would throw
// MissingSecret on every request, including client-side RSC navigations).
const localPassthrough = () => NextResponse.next();

const guarded = auth((req) => {
  const { pathname } = req.nextUrl;
  // Token-authenticated upload + the auth endpoints are exempt from the session gate.
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/results")) {
    return NextResponse.next();
  }
  if (!req.auth) {
    const url = new URL("/api/auth/signin", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export default (process.env.LOCAL_MODE === "1"
  ? localPassthrough
  : guarded) as typeof guarded;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
