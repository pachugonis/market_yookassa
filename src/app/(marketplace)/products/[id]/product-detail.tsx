"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { 
  Star, 
  Download, 
  ShoppingCart, 
  FileDown, 
  Calendar, 
  User,
  Loader2,
  CheckCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { formatPrice, formatDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: Date
  buyer: { name: string; avatar: string | null }
}

interface ProductDetailProps {
  product: {
    id: string
    title: string
    description: string
    price: number
    coverImage: string | null
    fileName: string
    fileSize: number
    downloadCount: number
    createdAt: Date
    seller: {
      id: string
      name: string
      avatar: string | null
      createdAt: Date
      _count: { products: number }
    }
    category: { name: string; slug: string }
    reviews: Review[]
    _count: { reviews: number; purchases: number }
  }
  avgRating: number
}

export function ProductDetail({ product, avgRating }: ProductDetailProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const handlePurchase = async () => {
    if (!session) {
      router.push("/login")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      })

      const data = await res.json()

      if (data.success && data.data.confirmationUrl) {
        window.location.href = data.data.confirmationUrl
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось создать платеж",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при создании платежа",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cover Image */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative aspect-video rounded-2xl overflow-hidden bg-secondary"
          >
            {product.coverImage ? (
              <Image
                src={product.coverImage}
                alt={product.title}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                <span className="text-8xl font-bold text-primary/30">
                  {product.title.charAt(0)}
                </span>
              </div>
            )}
          </motion.div>

          {/* Title & Category */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Badge variant="secondary" className="mb-3">
              {product.category.name}
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{product.title}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {avgRating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium text-foreground">{avgRating.toFixed(1)}</span>
                  <span>({product._count.reviews} отзывов)</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Download className="h-4 w-4" />
                <span>{product.downloadCount} скачиваний</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(new Date(product.createdAt))}</span>
              </div>
            </div>
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-xl font-semibold mb-3">Описание</h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-muted-foreground whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          </motion.div>

          {/* Reviews */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-semibold mb-4">
              Отзывы ({product._count.reviews})
            </h2>
            
            {product.reviews.length === 0 ? (
              <p className="text-muted-foreground">Пока нет отзывов</p>
            ) : (
              <div className="space-y-4">
                {product.reviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarImage src={review.buyer.avatar || ""} />
                          <AvatarFallback>
                            {review.buyer.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{review.buyer.name}</span>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < review.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-200"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          {review.comment && (
                            <p className="text-muted-foreground text-sm">
                              {review.comment}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDate(new Date(review.createdAt))}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="sticky top-24"
          >
            {/* Purchase Card */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-primary mb-4">
                  {formatPrice(product.price)}
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <FileDown className="h-4 w-4 text-muted-foreground" />
                    <span>{product.fileName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Размер: {formatFileSize(product.fileSize)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handlePurchase}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Обработка...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5" />
                        Купить сейчас
                      </>
                    )}
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Мгновенная доставка</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Безопасная оплата</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seller Card */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">О продавце</h3>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={product.seller.avatar || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {product.seller.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{product.seller.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.seller._count.products} товаров
                    </p>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>На платформе с {formatDate(new Date(product.seller.createdAt))}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
