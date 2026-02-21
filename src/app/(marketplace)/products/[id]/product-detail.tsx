"use client"

import { useState, useEffect } from "react"
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
  CheckCircle,
  Package,
  MessageSquare,
  Flag
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { formatPrice, formatDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { ReportDialog } from "@/components/ReportDialog"
import { ProductImageCarousel } from "@/components/ui/product-image-carousel"

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
    images?: Array<{ id: string; imageUrl: string; order: number }>
    _count: { reviews: number; purchases: number }
  }
  avgRating: number
  availableStock: number | null
}

export function ProductDetail({ product, avgRating, availableStock }: ProductDetailProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [hasPurchased, setHasPurchased] = useState(false)
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  // Prepare images for carousel
  const displayImages = (() => {
    const allImages: string[] = []
    
    // Add cover image first if it exists
    if (product.coverImage) {
      allImages.push(product.coverImage)
    }
    
    // Add additional images
    if (product.images && product.images.length > 0) {
      allImages.push(...product.images.map(img => img.imageUrl))
    }
    
    return allImages
  })()

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  useEffect(() => {
    if (session?.user) {
      checkPurchaseStatus()
    }
  }, [session])

  useEffect(() => {
    // Auto-open review form if coming from anchor link
    if (window.location.hash === '#reviews' && hasPurchased) {
      setShowReviewForm(true)
      // Scroll to reviews section
      setTimeout(() => {
        document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [hasPurchased])

  const checkPurchaseStatus = async () => {
    try {
      const res = await fetch("/api/purchases")
      const data = await res.json()
      if (data.success) {
        const purchased = data.data.some(
          (p: any) => p.productId === product.id && p.status === "COMPLETED"
        )
        setHasPurchased(purchased)
        
        // Check if user already has a review
        const existingReview = product.reviews.find(
          (r) => r.buyer.name === session?.user?.name
        )
        if (existingReview) {
          setUserReview(existingReview)
          setRating(existingReview.rating)
          setComment(existingReview.comment || "")
        }
      }
    } catch (error) {
      console.error("Error checking purchase status:", error)
    }
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

  const handleSubmitReview = async () => {
    if (!rating) return

    setIsSubmittingReview(true)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          rating,
          comment: comment.trim() || null,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: "Успешно",
          description: data.message || "Отзыв добавлен",
        })
        setShowReviewForm(false)
        // Refresh page to show new review
        router.refresh()
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось добавить отзыв",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при отправке отзыва",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingReview(false)
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
            className="rounded-2xl overflow-hidden"
          >
            <ProductImageCarousel
              images={displayImages}
              productTitle={product.title}
              className="aspect-video"
            />
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
            id="reviews"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Отзывы ({product._count.reviews})
              </h2>
              {hasPurchased && session?.user && !userReview && (
                <Button
                  variant={showReviewForm ? "outline" : "default"}
                  size="sm"
                  onClick={() => setShowReviewForm(!showReviewForm)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Оставить отзыв
                </Button>
              )}
            </div>

            {/* Review Form */}
            {showReviewForm && hasPurchased && !userReview && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Ваша оценка
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setRating(value)}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-8 w-8 cursor-pointer ${
                                value <= rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300 hover:text-yellow-200"
                              }`}
                            />
                          </button>
                        ))}
                        <span className="ml-2 text-sm text-muted-foreground">
                          {rating} из 5
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Комментарий (необязательно)
                      </label>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Расскажите о своем опыте использования товара..."
                        rows={4}
                        maxLength={1000}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {comment.length}/1000
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSubmitReview}
                        disabled={isSubmittingReview}
                      >
                        {isSubmittingReview ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Отправка...
                          </>
                        ) : (
                          "Отправить отзыв"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowReviewForm(false)}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* User's existing review - shown instead of form */}
            {userReview && (
              <Card className="mb-4 border-primary/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarImage src={userReview.buyer.avatar || ""} />
                      <AvatarFallback>
                        {userReview.buyer.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{userReview.buyer.name}</span>
                          <Badge variant="secondary" className="text-xs">Ваш отзыв</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < userReview.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {userReview.comment && (
                        <p className="text-muted-foreground text-sm">
                          {userReview.comment}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(new Date(userReview.createdAt))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
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
                  {availableStock !== null && (
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>
                        В наличии: <span className="font-semibold text-foreground">{availableStock}</span> ключ{availableStock === 1 ? '' : availableStock < 5 ? 'а' : 'ей'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handlePurchase}
                    disabled={isLoading || (availableStock !== null && availableStock === 0)}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Обработка...
                      </>
                    ) : availableStock === 0 ? (
                      "Нет в наличии"
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5" />
                        Купить сейчас
                      </>
                    )}
                  </Button>
                  
                  {session?.user && (
                    <ReportDialog 
                      type="PRODUCT" 
                      reportedId={product.id}
                      triggerText="Пожаловаться на товар"
                      triggerVariant="outline"
                    />
                  )}
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <User className="h-4 w-4" />
                  <span>На платформе с {formatDate(new Date(product.seller.createdAt))}</span>
                </div>
                
                {session?.user && session.user.id !== product.seller.id && (
                  <ReportDialog 
                    type="USER" 
                    reportedId={product.seller.id}
                    triggerText="Пожаловаться на продавца"
                    triggerVariant="ghost"
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
