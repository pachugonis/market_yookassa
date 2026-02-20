"use client"

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
  BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"

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
    title: "Категории", 
    href: "/admin/categories", 
    icon: FolderTree 
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

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-card border-r border-border h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b border-border">
        <Link href="/admin" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-bold text-lg">Админ панель</h2>
            <p className="text-xs text-muted-foreground">Управление сайтом</p>
          </div>
        </Link>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.title}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <Link 
          href="/"
          className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Вернуться на сайт
        </Link>
      </div>
    </aside>
  )
}
