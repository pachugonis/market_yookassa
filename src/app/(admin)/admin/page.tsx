import { prisma } from "@/lib/prisma"
import { Card } from "@/components/ui/card"
import { Users, Package, ShoppingCart, TrendingUp, DollarSign, Activity, Flag } from "lucide-react"

async function getAdminStats() {
  const [
    totalUsers,
    totalProducts,
    totalPurchases,
    totalRevenue,
    recentUsers,
    recentPurchases,
    usersByRole,
    totalReports,
    pendingReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.purchase.count(),
    prisma.purchase.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.purchase.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        buyer: { select: { name: true, email: true } },
        product: { select: { title: true, price: true } },
      },
    }),
    prisma.user.groupBy({
      by: ["role"],
      _count: true,
    }),
    prisma.report.count(),
    prisma.report.count({
      where: { status: "PENDING" },
    }),
  ])

  return {
    totalUsers,
    totalProducts,
    totalPurchases,
    totalRevenue: totalRevenue._sum.amount || 0,
    recentUsers,
    recentPurchases,
    usersByRole,
    totalReports,
    pendingReports,
  }
}

export default async function AdminDashboard() {
  const stats = await getAdminStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Панель администратора</h1>
        <p className="text-muted-foreground mt-2">Общая статистика и управление</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Пользователи</p>
              <h3 className="text-2xl font-bold mt-2">{stats.totalUsers}</h3>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            {stats.usersByRole.map((role: { role: string; _count: number }) => (
              <div key={role.role} className="flex justify-between mt-1">
                <span>{role.role}:</span>
                <span>{role._count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Товары</p>
              <h3 className="text-2xl font-bold mt-2">{stats.totalProducts}</h3>
            </div>
            <Package className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">Всего товаров на платформе</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Покупки</p>
              <h3 className="text-2xl font-bold mt-2">{stats.totalPurchases}</h3>
            </div>
            <ShoppingCart className="h-8 w-8 text-purple-500" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">Всего транзакций</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Оборот</p>
              <h3 className="text-2xl font-bold mt-2">{stats.totalRevenue.toLocaleString('ru-RU')} ₽</h3>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">Общая выручка</p>
        </Card>
      </div>

      {/* Reports Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Жалобы</p>
              <h3 className="text-2xl font-bold mt-2">{stats.totalReports}</h3>
            </div>
            <Flag className="h-8 w-8 text-orange-500" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">Всего жалоб от пользователей</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ожидают рассмотрения</p>
              <h3 className="text-2xl font-bold mt-2">{stats.pendingReports}</h3>
            </div>
            <Activity className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">Требуют внимания администратора</p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Users */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Новые пользователи</h3>
          </div>
          <div className="space-y-3">
            {stats.recentUsers.map((user: { id: string; name: string; email: string; role: string; createdAt: Date }) => (
              <div key={user.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2 py-1 bg-secondary rounded-full">{user.role}</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Purchases */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Последние покупки</h3>
          </div>
          <div className="space-y-3">
            {stats.recentPurchases.map((purchase: any) => (
              <div key={purchase.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="font-medium text-sm">{purchase.product.title}</p>
                  <p className="text-xs text-muted-foreground">{purchase.buyer.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">{purchase.amount.toLocaleString('ru-RU')} ₽</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(purchase.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
