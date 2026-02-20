import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user

  const isAuthPage = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register")
  const isSellerPage = nextUrl.pathname.startsWith("/dashboard")
  const isAdminPage = nextUrl.pathname.startsWith("/admin")
  const isApiRoute = nextUrl.pathname.startsWith("/api")
  const isPublicApiRoute = nextUrl.pathname.startsWith("/api/auth") || 
                           nextUrl.pathname.startsWith("/api/products") && req.method === "GET"

  // Allow public API routes
  if (isApiRoute && isPublicApiRoute) {
    return NextResponse.next()
  }

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // Protect admin panel
  if (isAdminPage) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl))
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", nextUrl))
    }
  }

  // Protect seller dashboard
  if (isSellerPage) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl))
    }
    if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
}
