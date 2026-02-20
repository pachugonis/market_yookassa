"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { 
  Package, 
  ShoppingCart, 
  Wallet, 
  TrendingUp,
  Plus,
  ArrowUpRight,
  Loader2
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatPrice, formatDate } from "@/lib/utils"

interface Stats {
  balance: number
  totalProducts: number
  totalSales: number
  totalEarnings: number
  recentSales: Array<{
    id: string
    amount: number
    sellerEarnings: number
    createdAt: string
    product: { title: string }
    buyer: { name: string }
  }>
}

type NumericStatKey = "balance" | "totalEarnings" | "totalSales" | "totalProducts"

const statCards: Array<{
  key: NumericStatKey
  label: string
  icon: typeof Wallet
  color: string
  bg: string
  isCount?: boolean
}> = [
  { key: "balance", label: "Баланс", icon: Wallet, color: "text-green-600", bg: "bg-green-100" },
  { key: "totalEarnings", label: "Всего заработано", icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-100" },
  { key: "totalSales", label: "Продаж", icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-100", isCount: true },
  { key: "totalProducts", label: "Товаров", icon: Package, color: "text-orange-600", bg: "bg-orange-100", isCount: true },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/seller/stats")
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Панель продавца</h1>
          <p className="text-muted-foreground">Управляйте своими товарами и продажами</p>
        </div>
        <Link href="/dashboard/products/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Добавить товар
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">
                    {stat.isCount 
                      ? (stats?.[stat.key] ?? 0)
                      : formatPrice(stats?.[stat.key] ?? 0)
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Sales */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Последние продажи</CardTitle>
            <Link href="/dashboard/sales">
              <Button variant="ghost" size="sm">
                Все продажи
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats?.recentSales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Пока нет продаж
              </p>
            ) : (
              <div className="space-y-4">
                {stats?.recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">{sale.product.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {sale.buyer.name} • {formatDate(new Date(sale.createdAt))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        +{formatPrice(sale.sellerEarnings)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        из {formatPrice(sale.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
