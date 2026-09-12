import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { readPlatformSettings } from "@/lib/platform-settings"

/**
 * Proxy (до Next 16 — middleware) отвечает ТОЛЬКО за навигацию
 * (редиректы для страниц).
 *
 * Авторизация обязана проверяться в каждом API-роуте и серверном
 * компоненте отдельно: proxy можно обойти (см. серию CVE
 * «Next.js Middleware bypass»), поэтому полагаться на него как на
 * единственный барьер нельзя.
 */

/**
 * Режим техработ читаем прямо из базы.
 *
 * Раньше здесь был `fetch` на собственный `/api/maintenance/status` по
 * публичному адресу запроса. Это был выход в интернет — DNS, TLS, nginx —
 * и возвращался он в тот же единственный процесс Node, который в этот
 * момент обслуживал исходный запрос. Ответ кэшировался на 10 секунд, и
 * ровно раз в 10 секунд очередной переход по сайту вставал на 5–10 секунд.
 *
 * Proxy в Next 16 работает в Node-runtime, поэтому Prisma доступна прямо
 * здесь, и посредник не нужен: локальный запрос к базе стоит доли
 * миллисекунды и всегда отдаёт свежее значение.
 */
async function isMaintenanceMode(): Promise<boolean> {
  const settings = await readPlatformSettings()

  // При недоступности базы сайт не блокируем
  return settings?.maintenanceMode ?? false
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

  // API-роуты защищают себя сами — proxy их не трогает
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
    if (await isMaintenanceMode()) {
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
