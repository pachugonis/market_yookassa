import { prisma } from "@/lib/prisma"
import { Card } from "@/components/ui/card"
import { 
  TrendingUp, 
  Users, 
  Package, 
  ShoppingCart, 
  DollarSign,
  ArrowUp,
  ArrowDown
} from "lucide-react"

async function getAnalytics() {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate())

  // Current period stats
  const [
    currentUsers,
    currentProducts,
    currentPurchases,
    currentRevenue,
    previousUsers,
    previousProducts,
    previousPurchases,
    previousRevenue,
    topProducts,
    topSellers,
    revenueByCategory,
    salesByDay,
  ] = await Promise.all([
    // Current period
    prisma.user.count({
      where: { createdAt: { gte: lastMonth } },
    }),
    prisma.product.count({
      where: { createdAt: { gte: lastMonth } },
    }),
    prisma.purchase.count({
      where: { 
        createdAt: { gte: lastMonth },
        status: "COMPLETED"
      },
    }),
    prisma.purchase.aggregate({
      where: { 
        createdAt: { gte: lastMonth },
        status: "COMPLETED"
      },
      _sum: { amount: true },
    }),
    // Previous period
    prisma.user.count({
      where: { 
        createdAt: { 
          gte: twoMonthsAgo,
          lt: lastMonth 
        } 
      },
    }),
    prisma.product.count({
      where: { 
        createdAt: { 
          gte: twoMonthsAgo,
          lt: lastMonth 
        } 
      },
    }),
    prisma.purchase.count({
      where: { 
        createdAt: { 
          gte: twoMonthsAgo,
          lt: lastMonth 
        },
        status: "COMPLETED"
      },
    }),
    prisma.purchase.aggregate({
      where: { 
        createdAt: { 
          gte: twoMonthsAgo,
          lt: lastMonth 
        },
        status: "COMPLETED"
      },
      _sum: { amount: true },
    }),
    // Top products
    prisma.product.findMany({
      take: 5,
      include: {
        _count: {
          select: { purchases: true },
        },
        category: {
          select: { name: true },
        },
      },
      orderBy: {
        purchases: {
          _count: "desc",
        },
      },
    }),
    // Top sellers
    prisma.user.findMany({
      where: { role: "SELLER" },
      take: 5,
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        products: {
          _count: "desc",
        },
      },
    }),
    // Revenue by category
    prisma.purchase.groupBy({
      by: ["productId"],
      where: { status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    }).then(async (purchases) => {
      const productIds = purchases.map((p) => p.productId)
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { category: true },
      })

      const categoryMap = new Map<string, { name: string; revenue: number; count: number }>()
      
      purchases.forEach((purchase) => {
        const product = products.find((p) => p.id === purchase.productId)
        if (product) {
          const existing = categoryMap.get(product.categoryId) || {
            name: product.category.name,
            revenue: 0,
            count: 0,
          }
          categoryMap.set(product.categoryId, {
            name: existing.name,
            revenue: existing.revenue + (purchase._sum.amount || 0),
            count: existing.count + purchase._count,
          })
        }
      })

      return Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue)
    }),
    // Sales by day (last 7 days)
    prisma.purchase.findMany({
      where: {
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        status: "COMPLETED",
      },
      select: {
        createdAt: true,
        amount: true,
      },
    }).then((purchases) => {
      const dayMap = new Map<string, { count: number; revenue: number }>()
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
        dayMap.set(dateStr, { count: 0, revenue: 0 })
      }

      purchases.forEach((purchase) => {
        const dateStr = new Date(purchase.createdAt).toLocaleDateString("ru-RU", { 
          day: "2-digit", 
          month: "2-digit" 
        })
        const existing = dayMap.get(dateStr) || { count: 0, revenue: 0 }
        dayMap.set(dateStr, {
          count: existing.count + 1,
          revenue: existing.revenue + purchase.amount,
        })
      })

      return Array.from(dayMap.entries()).map(([date, data]) => ({
        date,
        count: data.count,
        revenue: data.revenue,
      }))
    }),
  ])

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  return {
    users: {
      current: currentUsers,
      growth: calculateGrowth(currentUsers, previousUsers),
    },
    products: {
      current: currentProducts,
      growth: calculateGrowth(currentProducts, previousProducts),
    },
    purchases: {
      current: currentPurchases,
      growth: calculateGrowth(currentPurchases, previousPurchases),
    },
    revenue: {
      current: currentRevenue._sum.amount || 0,
      previous: previousRevenue._sum.amount || 0,
      growth: calculateGrowth(
        currentRevenue._sum.amount || 0,
        previousRevenue._sum.amount || 0
      ),
    },
    topProducts,
    topSellers,
    revenueByCategory,
    salesByDay,
  }
}

export default async function AnalyticsPage() {
  const analytics = await getAnalytics()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Аналитика</h1>
        <p className="text-muted-foreground mt-2">Статистика и показатели платформы за последний месяц</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Новые пользователи</p>
              <h3 className="text-2xl font-bold mt-2">{analytics.users.current}</h3>
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                analytics.users.growth >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {analytics.users.growth >= 0 ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
                <span>{Math.abs(analytics.users.growth)}%</span>
              </div>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Новые товары</p>
              <h3 className="text-2xl font-bold mt-2">{analytics.products.current}</h3>
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                analytics.products.growth >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {analytics.products.growth >= 0 ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
                <span>{Math.abs(analytics.products.growth)}%</span>
              </div>
            </div>
            <Package className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Покупки</p>
              <h3 className="text-2xl font-bold mt-2">{analytics.purchases.current}</h3>
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                analytics.purchases.growth >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {analytics.purchases.growth >= 0 ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
                <span>{Math.abs(analytics.purchases.growth)}%</span>
              </div>
            </div>
            <ShoppingCart className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Выручка</p>
              <h3 className="text-2xl font-bold mt-2">
                {(analytics.revenue.current / 100).toFixed(2)} ₽
              </h3>
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                analytics.revenue.growth >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {analytics.revenue.growth >= 0 ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
                <span>{Math.abs(analytics.revenue.growth)}%</span>
              </div>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Products */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Топ товары</h3>
          </div>
          <div className="space-y-3">
            {analytics.topProducts.map((product: any, index: number) => (
              <div key={product.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-6">{index + 1}</span>
                  <div>
                    <p className="font-medium text-sm">{product.title}</p>
                    <p className="text-xs text-muted-foreground">{product.category.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{product._count.purchases} продаж</p>
                  <p className="text-xs text-muted-foreground">{(product.price / 100).toFixed(2)} ₽</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Sellers */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Топ продавцы</h3>
          </div>
          <div className="space-y-3">
            {analytics.topSellers.map((seller: any, index: number) => (
              <div key={seller.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-6">{index + 1}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {seller.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{seller.name}</p>
                      <p className="text-xs text-muted-foreground">{seller.email}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{seller._count.products} товаров</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Revenue by Category */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Выручка по категориям</h3>
        <div className="space-y-4">
          {analytics.revenueByCategory.map((category: any) => {
            const maxRevenue = Math.max(...analytics.revenueByCategory.map((c: any) => c.revenue))
            const percentage = (category.revenue / maxRevenue) * 100

            return (
              <div key={category.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{category.name}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold">{(category.revenue / 100).toFixed(2)} ₽</span>
                    <span className="text-xs text-muted-foreground ml-2">({category.count} продаж)</span>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Sales by Day */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Продажи за последние 7 дней</h3>
        <div className="space-y-3">
          {analytics.salesByDay.map((day: any) => (
            <div key={day.date} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm font-medium">{day.date}</span>
              <div className="flex items-center gap-6">
                <span className="text-sm">{day.count} покупок</span>
                <span className="text-sm font-bold">{(day.revenue / 100).toFixed(2)} ₽</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
