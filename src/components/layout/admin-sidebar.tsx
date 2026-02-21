"use client"

import { useEffect, useState } from "react"
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
  Store
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

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

export function AdminSidebar() {
  const pathname = usePathname()
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
          const isReportsPage = item.href === "/admin/reports"
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium flex-1">{item.title}</span>
              {isReportsPage && pendingReportsCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-auto h-5 min-w-5 flex items-center justify-center px-1.5 text-xs"
                >
                  {pendingReportsCount > 99 ? "99+" : pendingReportsCount}
                </Badge>
              )}
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
