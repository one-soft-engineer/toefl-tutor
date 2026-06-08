import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Local mode and the auth/results APIs are exempt.
  if (process.env.LOCAL_MODE === "1") return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/results")) {
    return NextResponse.next();
  }
  if (!req.auth) {
    const url = new URL("/api/auth/signin", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
