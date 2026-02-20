import { prisma } from "@/lib/prisma"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProductStatus } from "@prisma/client"
import Image from "next/image"

async function getProducts() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      seller: {
        select: {
          name: true,
          email: true,
        },
      },
      category: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          purchases: true,
          reviews: true,
        },
      },
    },
  })
  return products
}

function getStatusBadge(status: ProductStatus) {
  const variants = {
    ACTIVE: "default",
    DRAFT: "secondary",
    INACTIVE: "outline",
  } as const

  const labels = {
    ACTIVE: "Активен",
    DRAFT: "Черновик",
    INACTIVE: "Неактивен",
  }

  return (
    <Badge variant={variants[status]}>
      {labels[status]}
    </Badge>
  )
}

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Товары</h1>
        <p className="text-muted-foreground mt-2">Все товары на платформе</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left p-4 font-medium">Товар</th>
                <th className="text-left p-4 font-medium">Продавец</th>
                <th className="text-left p-4 font-medium">Категория</th>
                <th className="text-left p-4 font-medium">Цена</th>
                <th className="text-left p-4 font-medium">Статус</th>
                <th className="text-left p-4 font-medium">Продано</th>
                <th className="text-left p-4 font-medium">Скачано</th>
                <th className="text-left p-4 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product: any) => (
                <tr key={product.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {product.coverImage ? (
                        <div className="h-12 w-12 rounded-lg overflow-hidden bg-secondary relative">
                          <Image
                            src={product.coverImage}
                            alt={product.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">Нет</span>
                        </div>
                      )}
                      <div className="max-w-xs">
                        <p className="font-medium truncate">{product.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {product.description.substring(0, 50)}...
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-sm">{product.seller.name}</p>
                    <p className="text-xs text-muted-foreground">{product.seller.email}</p>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{product.category.name}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-medium">{(product.price / 100).toFixed(2)} ₽</span>
                  </td>
                  <td className="p-4">{getStatusBadge(product.status)}</td>
                  <td className="p-4 text-center">{product._count.purchases}</td>
                  <td className="p-4 text-center">{product.downloadCount}</td>
                  <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(product.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Всего товаров</h3>
          <p className="text-3xl font-bold">{products.length}</p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Активных</h3>
          <p className="text-3xl font-bold">{products.filter((p: any) => p.status === "ACTIVE").length}</p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Черновиков</h3>
          <p className="text-3xl font-bold">{products.filter((p: any) => p.status === "DRAFT").length}</p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Общая выручка</h3>
          <p className="text-3xl font-bold">
            {(products.reduce((sum: number, p: any) => sum + (p.price * p._count.purchases), 0) / 100).toFixed(2)} ₽
          </p>
        </Card>
      </div>
    </div>
  )
}
