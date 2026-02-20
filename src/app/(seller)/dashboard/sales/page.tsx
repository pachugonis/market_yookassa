"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { ShoppingCart, Loader2, Calendar, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice, formatDate } from "@/lib/utils"

interface Sale {
  id: string
  amount: number
  commission: number
  sellerEarnings: number
  createdAt: string
  product: { id: string; title: string; coverImage: string | null }
  buyer: { name: string; email: string }
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSales()
  }, [])

  const fetchSales = async () => {
    try {
      const res = await fetch("/api/seller/sales")
      const data = await res.json()
      if (data.success) {
        setSales(data.data)
      }
    } catch (error) {
      console.error("Error fetching sales:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const totalEarnings = sales.reduce((sum, s) => sum + s.sellerEarnings, 0)
  const totalCommission = sales.reduce((sum, s) => sum + s.commission, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">История продаж</h1>
        <p className="text-muted-foreground">Все ваши завершенные продажи</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Всего продаж</p>
            <p className="text-3xl font-bold mt-1">{sales.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Ваш доход</p>
            <p className="text-3xl font-bold mt-1 text-green-600">
              {formatPrice(totalEarnings)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Комиссия (10%)</p>
            <p className="text-3xl font-bold mt-1 text-muted-foreground">
              {formatPrice(totalCommission)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales List */}
      {sales.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Нет продаж</h3>
            <p className="text-muted-foreground">
              Когда покупатели приобретут ваши товары, они появятся здесь
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Все продажи</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sales.map((sale, index) => (
                <motion.div
                  key={sale.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30"
                >
                  {/* Product Image */}
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-secondary shrink-0">
                    {sale.product.coverImage ? (
                      <Image
                        src={sale.product.coverImage}
                        alt={sale.product.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10">
                        <span className="font-bold text-primary/30">
                          {sale.product.title.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{sale.product.title}</h4>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {sale.buyer.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(sale.createdAt).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Earnings */}
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      +{formatPrice(sale.sellerEarnings)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      из {formatPrice(sale.amount)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
