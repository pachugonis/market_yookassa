"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  FolderTree,
  Shield,
  Settings,
  BarChart3,
  Flag,
  Store,
  Wallet,
  Menu
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const menuItems = [
  { 
    title: "Обзор", 
    href: "/admin", 
    icon: LayoutDashboard 
  },
  { 
    title: "Пользователи", 
    href: "/admin/users", 
    icon: Users 
  },
  { 
    title: "Товары", 
    href: "/admin/products", 
    icon: Package 
  },
  { 
    title: "Покупки", 
    href: "/admin/purchases", 
    icon: ShoppingCart 
  },
  {
    title: "Магазины",
    href: "/admin/stores",
    icon: Store
  },
  {
    title: "Выплаты",
    href: "/admin/payouts",
    icon: Wallet
  },
  { 
    title: "Категории", 
    href: "/admin/categories", 
    icon: FolderTree 
  },
  { 
    title: "Жалобы", 
    href: "/admin/reports", 
    icon: Flag 
  },
  { 
    title: "Статистика", 
    href: "/admin/analytics", 
    icon: BarChart3 
  },
  { 
    title: "Настройки", 
    href: "/admin/settings", 
    icon: Settings 
  },
]

/**
 * Счётчик необработанных жалоб живёт в хуке, потому что его показывают
 * сразу два меню — боковое на ноутбуке и выдвижное на телефоне.
 */
function usePendingReportsCount() {
  const [pendingReportsCount, setPendingReportsCount] = useState(0)

  useEffect(() => {
    const fetchPendingReports = async () => {
      try {
        const response = await fetch("/api/admin/reports?status=PENDING&limit=1")
        const data = await response.json()
        if (response.ok && data.pagination) {
          setPendingReportsCount(data.pagination.total)
        }
      } catch (error) {
        console.error("Error fetching pending reports:", error)
      }
    }

    fetchPendingReports()
    
    // Listen for report status changes
    const handleReportChange = () => {
      fetchPendingReports()
    }
    window.addEventListener("reportStatusChanged", handleReportChange)
    
    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingReports, 30000)
    
    return () => {
      window.removeEventListener("reportStatusChanged", handleReportChange)
      clearInterval(interval)
    }
  }, [])

  return pendingReportsCount
}

/**
 * Список ссылок без обёртки: одинаковый на ноутбуке и в выдвижном меню.
 * На телефоне каждый пункт дополнительно закрывает панель, поэтому
 * ссылки оборачиваются в `SheetClose`.
 */
function AdminNavLinks({
  pendingReportsCount,
  onNavigate,
}: {
  pendingReportsCount: number
  onNavigate?: boolean
}) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-4">
      {menuItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        const isReportsPage = item.href === "/admin/reports"

        const link = (
          <Link
            href={item.href}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 font-medium">{item.title}</span>
            {isReportsPage && pendingReportsCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-auto flex h-5 min-w-5 items-center justify-center px-1.5 text-xs"
              >
                {pendingReportsCount > 99 ? "99+" : pendingReportsCount}
              </Badge>
            )}
          </Link>
        )

        return onNavigate ? (
          <SheetClose asChild key={item.href}>
            {link}
          </SheetClose>
        ) : (
          <React.Fragment key={item.href}>{link}</React.Fragment>
        )
      })}
    </nav>
  )
}

function AdminSidebarHeader() {
  return (
    <Link href="/admin" className="flex items-center gap-2">
      <Shield className="h-6 w-6 shrink-0 text-primary" />
      <div>
        <h2 className="text-lg font-bold">Админ панель</h2>
        <p className="text-xs text-muted-foreground">Управление сайтом</p>
      </div>
    </Link>
  )
}

function BackToSiteLink() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      ← Вернуться на сайт
    </Link>
  )
}

/** Боковое меню на ноутбуке. На узких экранах его заменяет `AdminMobileNav`. */
export function AdminSidebar() {
  const pendingReportsCount = usePendingReportsCount()

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="border-b border-border p-6">
        <AdminSidebarHeader />
      </div>

      <AdminNavLinks pendingReportsCount={pendingReportsCount} />

      <div className="border-t border-border p-4">
        <BackToSiteLink />
      </div>
    </aside>
  )
}

/**
 * Шапка с кнопкой меню — только для телефонов и планшетов: на них
 * фиксированная колонка в 256 px съела бы две трети экрана.
 */
export function AdminMobileNav() {
  const pendingReportsCount = usePendingReportsCount()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="sticky top-0 z-[95] flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger
          className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Открыть меню"
        >
          <Menu className="h-6 w-6" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0">
          <div className="border-b border-border p-5 pr-14">
            <SheetTitle asChild>
              <div>
                <AdminSidebarHeader />
              </div>
            </SheetTitle>
          </div>

          <AdminNavLinks pendingReportsCount={pendingReportsCount} onNavigate />

          <div className="border-t border-border p-4">
            <SheetClose asChild>
              <BackToSiteLink />
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>

      <Link href="/admin" className="flex min-w-0 items-center gap-2">
        <Shield className="h-5 w-5 shrink-0 text-primary" />
        <span className="truncate font-semibold">Админ панель</span>
      </Link>

      {pendingReportsCount > 0 && (
        <Badge
          variant="destructive"
          className="ml-auto flex h-5 min-w-5 items-center justify-center px-1.5 text-xs"
        >
          {pendingReportsCount > 99 ? "99+" : pendingReportsCount}
        </Badge>
      )}
    </div>
  )
}
