"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { 
  Store, 
  Package, 
  Star, 
  TrendingUp, 
  Loader2,
  RefreshCw,
  Calendar,
  Wallet,
  ShoppingBag,
  Eye,
  Search
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { formatPrice, formatDate } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

interface SellerStats {
  activeProducts: number
  totalProducts: number
  totalSales: number
  totalRevenue: number
  avgRating: number
  totalReviews: number
}

interface Seller {
  id: string
  name: string
  email: string
  avatar: string | null
  role: string
  balance: number
  verified: boolean
  createdAt: string
  stats: SellerStats
  products: Array<{
    id: string
    title: string
    status: string
    price: number
  }>
}

export default function AdminStoresPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [filteredSellers, setFilteredSellers] = useState<Seller[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null)

  const fetchSellers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/admin/stores")
      const data = await response.json()

      if (data.success) {
        setSellers(data.data)
        setFilteredSellers(data.data)
      }
    } catch (error) {
      console.error("Error fetching sellers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSellers()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredSellers(sellers)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = sellers.filter(
        (seller) =>
          seller.name.toLowerCase().includes(query) ||
          seller.email.toLowerCase().includes(query)
      )
      setFilteredSellers(filtered)
    }
  }, [searchQuery, sellers])

  const totalStats = sellers.reduce(
    (acc, seller) => ({
      totalSellers: acc.totalSellers + 1,
      totalProducts: acc.totalProducts + seller.stats.totalProducts,
      activeProducts: acc.activeProducts + seller.stats.activeProducts,
      totalRevenue: acc.totalRevenue + seller.stats.totalRevenue,
      totalSales: acc.totalSales + seller.stats.totalSales,
    }),
    {
      totalSellers: 0,
      totalProducts: 0,
      activeProducts: 0,
      totalRevenue: 0,
      totalSales: 0,
    }
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Магазины</h1>
          <p className="text-muted-foreground mt-2">
            Управление продавцами и их магазинами
          </p>
        </div>
        <Button onClick={fetchSellers} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Магазинов</p>
              <h3 className="text-2xl font-bold mt-2">{totalStats.totalSellers}</h3>
            </div>
            <Store className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Всего товаров</p>
              <h3 className="text-2xl font-bold mt-2">{totalStats.totalProducts}</h3>
            </div>
            <Package className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Активных</p>
              <h3 className="text-2xl font-bold mt-2">{totalStats.activeProducts}</h3>
            </div>
            <ShoppingBag className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Продаж</p>
              <h3 className="text-2xl font-bold mt-2">{totalStats.totalSales}</h3>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Выручка</p>
              <h3 className="text-2xl font-bold mt-2">
                {formatPrice(totalStats.totalRevenue)}
              </h3>
            </div>
            <Wallet className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Sellers Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left p-4 font-medium">Продавец</th>
                <th className="text-left p-4 font-medium">Email</th>
                <th className="text-center p-4 font-medium">Товары</th>
                <th className="text-center p-4 font-medium">Продажи</th>
                <th className="text-center p-4 font-medium">Рейтинг</th>
                <th className="text-left p-4 font-medium">Выручка</th>
                <th className="text-left p-4 font-medium">Баланс</th>
                <th className="text-center p-4 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : filteredSellers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {searchQuery ? "Продавцы не найдены" : "Нет продавцов"}
                  </td>
                </tr>
              ) : (
                filteredSellers.map((seller) => (
                  <tr
                    key={seller.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/50"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={seller.avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {seller.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{seller.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={seller.role === "ADMIN" ? "destructive" : "default"} className="text-xs">
                              {seller.role === "ADMIN" ? "Админ" : "Продавец"}
                            </Badge>
                            {seller.verified && (
                              <span className="text-xs text-green-600">✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {seller.email}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-medium">{seller.stats.totalProducts}</span>
                        <span className="text-xs text-muted-foreground">
                          ({seller.stats.activeProducts} активных)
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center font-medium">
                      {seller.stats.totalSales}
                    </td>
                    <td className="p-4">
                      {seller.stats.totalReviews > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{seller.stats.avgRating}</span>
                          <span className="text-xs text-muted-foreground">
                            ({seller.stats.totalReviews})
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Нет отзывов</span>
                      )}
                    </td>
                    <td className="p-4 font-medium">
                      {formatPrice(seller.stats.totalRevenue)}
                    </td>
                    <td className="p-4 font-medium">
                      {formatPrice(seller.balance)}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedSeller(seller)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-3">
                                <Avatar className="h-12 w-12">
                                  <AvatarImage src={seller.avatar || undefined} />
                                  <AvatarFallback className="bg-primary/10 text-primary">
                                    {seller.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div>{seller.name}</div>
                                  <div className="text-sm font-normal text-muted-foreground">
                                    {seller.email}
                                  </div>
                                </div>
                              </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                              {/* Seller Info */}
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <p className="text-sm text-muted-foreground">Роль</p>
                                  <Badge variant={seller.role === "ADMIN" ? "destructive" : "default"}>
                                    {seller.role === "ADMIN" ? "Администратор" : "Продавец"}
                                  </Badge>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm text-muted-foreground">Статус</p>
                                  <Badge variant={seller.verified ? "success" : "secondary"}>
                                    {seller.verified ? "Подтвержден" : "Не подтвержден"}
                                  </Badge>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm text-muted-foreground">Дата регистрации</p>
                                  <p className="font-medium">{formatDate(new Date(seller.createdAt))}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm text-muted-foreground">Баланс</p>
                                  <p className="font-medium">{formatPrice(seller.balance)}</p>
                                </div>
                              </div>

                              <Separator />

                              {/* Stats */}
                              <div>
                                <h4 className="font-semibold mb-3">Статистика</h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <Card className="p-3">
                                    <p className="text-xs text-muted-foreground">Всего товаров</p>
                                    <p className="text-2xl font-bold">{seller.stats.totalProducts}</p>
                                  </Card>
                                  <Card className="p-3">
                                    <p className="text-xs text-muted-foreground">Активных товаров</p>
                                    <p className="text-2xl font-bold">{seller.stats.activeProducts}</p>
                                  </Card>
                                  <Card className="p-3">
                                    <p className="text-xs text-muted-foreground">Продаж</p>
                                    <p className="text-2xl font-bold">{seller.stats.totalSales}</p>
                                  </Card>
                                  <Card className="p-3">
                                    <p className="text-xs text-muted-foreground">Выручка</p>
                                    <p className="text-2xl font-bold">{formatPrice(seller.stats.totalRevenue)}</p>
                                  </Card>
                                </div>
                              </div>

                              <Separator />

                              {/* Products List */}
                              <div>
                                <h4 className="font-semibold mb-3">
                                  Товары ({seller.products.length})
                                </h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {seller.products.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                      Нет товаров
                                    </p>
                                  ) : (
                                    seller.products.map((product) => (
                                      <Link
                                        key={product.id}
                                        href={`/admin/products`}
                                        className="block p-3 rounded-lg border hover:bg-secondary/50 transition-colors"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{product.title}</p>
                                            <p className="text-sm text-muted-foreground">
                                              {formatPrice(product.price)}
                                            </p>
                                          </div>
                                          <Badge
                                            variant={
                                              product.status === "ACTIVE"
                                                ? "success"
                                                : product.status === "PENDING"
                                                ? "secondary"
                                                : "destructive"
                                            }
                                          >
                                            {product.status === "ACTIVE"
                                              ? "Активен"
                                              : product.status === "PENDING"
                                              ? "Ожидает"
                                              : "Неактивен"}
                                          </Badge>
                                        </div>
                                      </Link>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Quick Actions */}
                              <div className="flex gap-2 pt-4">
                                <Button asChild className="flex-1">
                                  <Link href={`/products?seller=${seller.id}`}>
                                    Посмотреть товары на сайте
                                  </Link>
                                </Button>
                                <Button asChild variant="outline" className="flex-1">
                                  <Link href={`/admin/users`}>
                                    Управление пользователем
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
