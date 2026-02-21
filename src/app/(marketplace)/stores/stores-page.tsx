"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Store, Package, Star, TrendingUp } from "lucide-react"

interface Seller {
  id: string
  name: string
  email: string
  avatar: string | null
  createdAt: string
  _count: {
    products: number
  }
  products: Array<{
    id: string
    reviews: Array<{
      rating: number
    }>
  }>
}

export function StoresPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const response = await fetch("/api/sellers")
        if (response.ok) {
          const data = await response.json()
          setSellers(data)
        }
      } catch (error) {
        console.error("Failed to fetch sellers:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSellers()
  }, [])

  const calculateAverageRating = (products: Seller["products"]) => {
    const allReviews = products.flatMap(p => p.reviews)
    if (allReviews.length === 0) return 0
    const sum = allReviews.reduce((acc, review) => acc + review.rating, 0)
    return (sum / allReviews.length).toFixed(1)
  }

  const getTotalReviews = (products: Seller["products"]) => {
    return products.reduce((acc, p) => acc + p.reviews.length, 0)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <Store className="h-12 w-12 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold">Магазины</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Познакомьтесь с продавцами нашей платформы и посмотрите их товары
        </p>
      </motion.div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Sellers Grid */}
      {!isLoading && sellers.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {sellers.map((seller, index) => {
            const avgRating = calculateAverageRating(seller.products)
            const totalReviews = getTotalReviews(seller.products)
            
            return (
              <motion.div
                key={seller.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={seller.avatar || undefined} alt={seller.name} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                          {seller.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl truncate">{seller.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            <Store className="h-3 w-3 mr-1" />
                            Продавец
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{seller._count.products}</span>
                        <span className="text-muted-foreground">товаров</span>
                      </div>
                      {totalReviews > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{avgRating}</span>
                          <span className="text-muted-foreground">({totalReviews})</span>
                        </div>
                      )}
                    </div>

                    {/* Member Since */}
                    <div className="text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3 inline mr-1" />
                      На платформе с {new Date(seller.createdAt).toLocaleDateString("ru-RU", {
                        month: "long",
                        year: "numeric"
                      })}
                    </div>

                    {/* View Products Button */}
                    <Link href={`/products?seller=${seller.id}`} className="block">
                      <Button className="w-full" variant="outline">
                        Посмотреть товары
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Empty State */}
      {!isLoading && sellers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Пока нет продавцов</h2>
          <p className="text-muted-foreground">
            Продавцы появятся здесь, когда зарегистрируются на платформе
          </p>
        </motion.div>
      )}
    </div>
  )
}
