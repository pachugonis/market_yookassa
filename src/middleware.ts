import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * Middleware отвечает ТОЛЬКО за навигацию (редиректы для страниц).
 *
 * Авторизация обязана проверяться в каждом API-роуте и серверном
 * компоненте отдельно: middleware можно обойти (см. серию CVE
 * «Next.js Middleware bypass»), поэтому полагаться на него как на
 * единственный барьер нельзя.
 */

// Статус техработ меняется редко, а запрос идёт на каждый переход.
// Кэшируем на несколько секунд, чтобы не ходить в API постоянно.
const MAINTENANCE_TTL_MS = 10_000
let maintenanceCache: { value: boolean; expiresAt: number } | null = null

async function isMaintenanceMode(requestUrl: string): Promise<boolean> {
  const now = Date.now()

  if (maintenanceCache && maintenanceCache.expiresAt > now) {
    return maintenanceCache.value
  }

  try {
    const url = new URL("/api/maintenance/status", requestUrl)
    const response = await fetch(url.toString())
    const { maintenanceMode } = await response.json()
    const value = Boolean(maintenanceMode)

    maintenanceCache = { value, expiresAt: now + MAINTENANCE_TTL_MS }
    return value
  } catch (error) {
    console.error("Error checking maintenance mode:", error)
    // При недоступности API сайт не блокируем
    return false
  }
}

export default auth(async (req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user
  const isAdmin = isLoggedIn && session.user.role === "ADMIN"

  const isAuthPage =
    nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register")
  const isSellerPage = nextUrl.pathname.startsWith("/dashboard")
  const isAdminPage = nextUrl.pathname.startsWith("/admin")
  const isAdminLoginPage = nextUrl.pathname === "/admin-login"
  const isApiRoute = nextUrl.pathname.startsWith("/api")
  const isMaintenancePage = nextUrl.pathname.startsWith("/maintenance")

  // API-роуты защищают себя сами — middleware их не трогает
  if (isApiRoute) {
    return NextResponse.next()
  }

  // Always allow admin login page
  if (isAdminLoginPage) {
    // If already logged in as admin, redirect to admin panel
    if (isAdmin) {
      return NextResponse.redirect(new URL("/admin", nextUrl))
    }
    return NextResponse.next()
  }

  // Check maintenance mode (exclude admin routes and admin login)
  if (!isMaintenancePage && !isAdminPage) {
    if (await isMaintenanceMode(req.url)) {
      if (!isAdmin) {
        return NextResponse.redirect(new URL("/maintenance", nextUrl))
      }
    }
  }

  // If maintenance mode is disabled, don't allow access to maintenance page
  if (isMaintenancePage && isAdmin) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // Protect admin panel (but not admin login)
  if (isAdminPage) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/admin-login", nextUrl))
    }
    if (!isAdmin) {
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
