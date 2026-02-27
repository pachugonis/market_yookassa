import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export default auth(async (req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user

  const isAuthPage = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register")
  const is2FAPage = nextUrl.pathname.startsWith("/verify-2fa")
  const isSellerPage = nextUrl.pathname.startsWith("/dashboard")
  const isAdminPage = nextUrl.pathname.startsWith("/admin")
  const isAdminLoginPage = nextUrl.pathname === "/admin-login"
  const isApiRoute = nextUrl.pathname.startsWith("/api")
  const isMaintenancePage = nextUrl.pathname.startsWith("/maintenance")
  const isPublicApiRoute = nextUrl.pathname.startsWith("/api/auth") || 
                           nextUrl.pathname.startsWith("/api/products") && req.method === "GET"

  // Always allow admin login page
  if (isAdminLoginPage) {
    // If already logged in as admin, redirect to admin panel
    if (isLoggedIn && session.user.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", nextUrl))
    }
    return NextResponse.next()
  }

  // Check maintenance mode (exclude admin routes and admin login)
  if (!isMaintenancePage && !isAdminPage && !isApiRoute) {
    try {
      const settings = await prisma.platformSettings.findFirst()
      const isMaintenanceMode = settings?.maintenanceMode ?? false
      
      // If maintenance mode is enabled and user is not logged in as admin, redirect to maintenance page
      if (isMaintenanceMode) {
        const isAdmin = isLoggedIn && session.user.role === "ADMIN"
        if (!isAdmin) {
          return NextResponse.redirect(new URL("/maintenance", nextUrl))
        }
      }
    } catch (error) {
      console.error("Error checking maintenance mode:", error)
    }
  }

  // If maintenance mode is disabled, don't allow access to maintenance page
  if (isMaintenancePage && session?.user?.role === "ADMIN") {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // Allow public API routes
  if (isApiRoute && isPublicApiRoute) {
    return NextResponse.next()
  }

  // Allow 2FA verification page
  if (is2FAPage) {
    return NextResponse.next()
  }

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // Protect admin panel (but not admin login)
  if (isAdminPage && !isAdminLoginPage) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/admin-login", nextUrl))
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
