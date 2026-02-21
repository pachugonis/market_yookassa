import { prisma } from "@/lib/prisma"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PurchaseStatus } from "@prisma/client"

async function getPurchases() {
  const purchases = await prisma.purchase.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      buyer: {
        select: {
          name: true,
          email: true,
        },
      },
      product: {
        select: {
          title: true,
          price: true,
        },
      },
    },
  })
  return purchases
}

function getStatusBadge(status: PurchaseStatus) {
  const variants = {
    COMPLETED: "default",
    PENDING: "secondary",
    FAILED: "destructive",
    REFUNDED: "outline",
  } as const

  const labels = {
    COMPLETED: "Завершена",
    PENDING: "Ожидает",
    FAILED: "Ошибка",
    REFUNDED: "Возврат",
  }

  return (
    <Badge variant={variants[status]}>
      {labels[status]}
    </Badge>
  )
}

export default async function PurchasesPage() {
  const purchases = await getPurchases()

  const stats = {
    total: purchases.length,
    completed: purchases.filter((p: any) => p.status === "COMPLETED").length,
    pending: purchases.filter((p: any) => p.status === "PENDING").length,
    totalRevenue: purchases
      .filter((p: any) => p.status === "COMPLETED")
      .reduce((sum: number, p: any) => sum + p.amount, 0),
    platformEarnings: purchases
      .filter((p: any) => p.status === "COMPLETED")
      .reduce((sum: number, p: any) => sum + p.commission, 0),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Покупки</h1>
        <p className="text-muted-foreground mt-2">Все транзакции на платформе</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Всего покупок</h3>
          <p className="text-3xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Завершено</h3>
          <p className="text-3xl font-bold">{stats.completed}</p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">В ожидании</h3>
          <p className="text-3xl font-bold">{stats.pending}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Выручка</h3>
          <p className="text-3xl font-bold">{stats.totalRevenue.toLocaleString('ru-RU')} ₽</p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Заработок</h3>
          <p className="text-3xl font-bold text-green-600">{stats.platformEarnings.toLocaleString('ru-RU')} ₽</p>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left p-4 font-medium">ID</th>
                <th className="text-left p-4 font-medium">Покупатель</th>
                <th className="text-left p-4 font-medium">Товар</th>
                <th className="text-left p-4 font-medium">Сумма</th>
                <th className="text-left p-4 font-medium">Комиссия</th>
                <th className="text-left p-4 font-medium">Продавцу</th>
                <th className="text-left p-4 font-medium">Статус</th>
                <th className="text-left p-4 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase: any) => (
                <tr key={purchase.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="p-4">
                    <code className="text-xs bg-secondary px-2 py-1 rounded">
                      {purchase.id.substring(0, 8)}
                    </code>
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-medium">{purchase.buyer.name}</p>
                    <p className="text-xs text-muted-foreground">{purchase.buyer.email}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-sm max-w-xs truncate">{purchase.product.title}</p>
                  </td>
                  <td className="p-4">
                    <span className="font-medium">{purchase.amount.toLocaleString('ru-RU')} ₽</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-red-600">{purchase.commission.toLocaleString('ru-RU')} ₽</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-green-600">{purchase.sellerEarnings.toLocaleString('ru-RU')} ₽</span>
                  </td>
                  <td className="p-4">{getStatusBadge(purchase.status)}</td>
                  <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(purchase.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
