"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  LogOut,
  ShoppingBag,
  ChevronLeft,
  AlertCircle,
  Menu
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { useSiteName } from "@/components/layout/site-settings-provider"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Обзор" },
  { href: "/dashboard/products", icon: Package, label: "Товары" },
  { href: "/dashboard/sales", icon: ShoppingCart, label: "Продажи" },
  { href: "/dashboard/earnings", icon: Wallet, label: "Доходы" },
  { href: "/dashboard/disputes", icon: AlertCircle, label: "Споры" },
]

/**
 * Ссылки кабинета, общие для боковой колонки и выдвижного меню.
 * В выдвижном каждая ссылка ещё и закрывает панель — иначе после
 * перехода она осталась бы висеть поверх новой страницы.
 */
function SellerNavLinks({ onNavigate }: { onNavigate?: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-4">
      {navItems.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href))

        const link = (
          <Link
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {item.label}
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

function SellerSidebarFooter({ onNavigate }: { onNavigate?: boolean }) {
  const backLink = (
    <Link
      href="/"
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <ChevronLeft className="h-5 w-5 shrink-0" />
      Вернуться в магазин
    </Link>
  )

  return (
    <div className="space-y-1 p-4">
      {onNavigate ? <SheetClose asChild>{backLink}</SheetClose> : backLink}
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
      >
        <LogOut className="h-5 w-5 shrink-0" />
        Выйти
      </button>
    </div>
  )
}

/** Боковое меню на ноутбуке; на телефоне его заменяет `SellerMobileNav`. */
export function SellerSidebar() {
  const siteName = useSiteName()

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-background md:flex">
      {/* Header */}
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
          <ShoppingBag className="h-7 w-7 shrink-0" />
          <span className="truncate">{siteName}</span>
        </Link>
      </div>

      <Separator />

      <SellerNavLinks />

      <Separator />

      <SellerSidebarFooter />
    </aside>
  )
}

/**
 * Шапка кабинета для узких экранов. Раньше боковое меню на телефоне
 * просто скрывалось (`hidden md:flex`), и внутри кабинета не оставалось
 * ни одной ссылки на его разделы.
 */
export function SellerMobileNav() {
  const siteName = useSiteName()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="sticky top-0 z-[95] flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger
          className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Открыть меню"
        >
          <Menu className="h-6 w-6" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0">
          <div className="p-5 pr-14">
            <SheetTitle asChild>
              <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
                <ShoppingBag className="h-7 w-7 shrink-0" />
                <span className="truncate">{siteName}</span>
              </Link>
            </SheetTitle>
          </div>

          <Separator />

          <SellerNavLinks onNavigate />

          <Separator />

          <SellerSidebarFooter onNavigate />
        </SheetContent>
      </Sheet>

      <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
        <ShoppingBag className="h-5 w-5 shrink-0 text-primary" />
        <span className="truncate font-semibold">Кабинет продавца</span>
      </Link>
    </div>
  )
}
