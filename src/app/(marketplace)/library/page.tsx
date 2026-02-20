"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "framer-motion"
import { Download, Package, Calendar, FileDown, Loader2, Key, Copy, Check, MessageSquare, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPrice, formatDate } from "@/lib/utils"

interface Purchase {
  id: string
  amount: number
  status: string
  downloadToken: string | null
  downloadCount: number
  createdAt: string
  product: {
    id: string
    title: string
    coverImage: string | null
    fileName: string
    fileSize: number
  }
  licenseKey: {
    id: string
    key: string
  } | null
  dispute: {
    id: string
    status: string
    createdAt: string
  } | null
  hasReview?: boolean
}

export default function LibraryPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [openingDispute, setOpeningDispute] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState("")
  const [showDisputeDialog, setShowDisputeDialog] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login")
    }
  }, [sessionStatus, router])

  useEffect(() => {
    if (session) {
      fetchPurchases()
    }
  }, [session])

  const fetchPurchases = async () => {
    try {
      const res = await fetch("/api/purchases")
      const data = await res.json()
      if (data.success) {
        // Fetch user reviews to check which products already have reviews
        const reviewsRes = await fetch("/api/reviews/my-reviews")
        const reviewsData = await reviewsRes.json()
        const reviewedProductIds = reviewsData.success 
          ? new Set(reviewsData.data.map((r: any) => r.productId))
          : new Set()
        
        // Mark purchases that already have reviews
        const purchasesWithReviewStatus = data.data.map((p: Purchase) => ({
          ...p,
          hasReview: reviewedProductIds.has(p.product.id)
        }))
        
        setPurchases(purchasesWithReviewStatus)
      }
    } catch (error) {
      console.error("Error fetching purchases:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (purchase: Purchase) => {
    if (!purchase.downloadToken) return
    
    setDownloadingId(purchase.id)
    try {
      const url = `/api/purchases/${purchase.id}/download?token=${purchase.downloadToken}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error("Download failed")
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = purchase.product.fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      a.remove()
      
      // Refresh purchases to update download count
      fetchPurchases()
    } catch (error) {
      console.error("Download error:", error)
    } finally {
      setDownloadingId(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const copyLicenseKey = async (key: string, purchaseId: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKey(purchaseId)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const canOpenDispute = (purchase: Purchase) => {
    if (purchase.status !== "COMPLETED") return false
    if (purchase.dispute) return false
    if (purchase.hasReview) return false
    
    const hoursSincePurchase = (Date.now() - new Date(purchase.createdAt).getTime()) / (1000 * 60 * 60)
    return hoursSincePurchase <= 24
  }

  const handleOpenDispute = async (purchaseId: string) => {
    if (!disputeReason.trim()) {
      alert("Пожалуйста, укажите причину спора")
      return
    }

    setOpeningDispute(purchaseId)
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId,
          reason: disputeReason,
        }),
      })

      const data = await res.json()

      if (data.success) {
        alert(data.message || "Спор открыт")
        setShowDisputeDialog(null)
        setDisputeReason("")
        fetchPurchases()
      } else {
        alert(data.error || "Ошибка при открытии спора")
      }
    } catch (error) {
      console.error("Error opening dispute:", error)
      alert("Ошибка при открытии спора")
    } finally {
      setOpeningDispute(null)
    }
  }

  if (sessionStatus === "loading" || isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Мои покупки</h1>
        <p className="text-muted-foreground">
          Скачивайте приобретенные товары в любое время
        </p>
      </motion.div>

      {purchases.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Пока нет покупок</h2>
          <p className="text-muted-foreground mb-6">
            Приобретенные товары появятся здесь
          </p>
          <Button onClick={() => router.push("/products")}>
            Перейти в каталог
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          {purchases.map((purchase, index) => (
            <motion.div
              key={purchase.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Cover Image */}
                    <div className="relative w-full md:w-32 h-24 rounded-lg overflow-hidden bg-secondary shrink-0">
                      {purchase.product.coverImage ? (
                        <Image
                          src={purchase.product.coverImage}
                          alt={purchase.product.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10">
                          <span className="text-2xl font-bold text-primary/30">
                            {purchase.product.title.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-lg truncate">
                            {purchase.product.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(new Date(purchase.createdAt))}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileDown className="h-4 w-4" />
                              {formatFileSize(purchase.product.fileSize)}
                            </span>
                            <span>{formatPrice(purchase.amount)}</span>
                          </div>
                        </div>
                        <Badge
                          variant={
                            purchase.status === "COMPLETED" ? "success" : 
                            purchase.status === "PENDING" ? "secondary" : "destructive"
                          }
                        >
                          {purchase.status === "COMPLETED" ? "Оплачено" :
                           purchase.status === "PENDING" ? "Ожидание" : "Ошибка"}
                        </Badge>
                      </div>

                      {/* Download Button */}
                      {purchase.status === "COMPLETED" && purchase.downloadToken && (
                        <div className="mt-4 space-y-3">
                          {/* Dispute Warning */}
                          {purchase.dispute && purchase.dispute.status === "OPEN" && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
                              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                              <div className="text-sm">
                                <p className="font-medium text-yellow-900 dark:text-yellow-100">Открыт спор</p>
                                <p className="text-yellow-700 dark:text-yellow-300 mt-0.5">
                                  Сделка на паузе. Средства заблокированы до разрешения.
                                </p>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 h-auto text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100"
                                  onClick={() => router.push(`/disputes`)}
                                >
                                  Перейти к спору →
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* License Key */}
                          {purchase.licenseKey && (
                            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Key className="h-4 w-4 text-primary shrink-0" />
                                  <span className="font-mono text-sm font-medium truncate">
                                    {purchase.licenseKey.key}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyLicenseKey(purchase.licenseKey!.key, purchase.id)}
                                  className="shrink-0"
                                >
                                  {copiedKey === purchase.id ? (
                                    <>
                                      <Check className="h-4 w-4 text-green-500" />
                                      Скопировано
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4" />
                                      Копировать
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Download Button */}
                          <div className="flex items-center gap-4 flex-wrap">
                            <Button
                              onClick={() => handleDownload(purchase)}
                              disabled={downloadingId === purchase.id}
                            >
                              {downloadingId === purchase.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Загрузка...
                                </>
                              ) : (
                                <>
                                  <Download className="h-4 w-4" />
                                  Скачать
                                </>
                              )}
                            </Button>
                            {!purchase.hasReview && !purchase.dispute && (
                              <Button
                                variant="outline"
                                onClick={() => router.push(`/products/${purchase.product.id}#reviews`)}
                              >
                                <MessageSquare className="h-4 w-4" />
                                Оставить отзыв
                              </Button>
                            )}
                            {canOpenDispute(purchase) && (
                              <Button
                                variant="destructive"
                                onClick={() => setShowDisputeDialog(purchase.id)}
                              >
                                <AlertCircle className="h-4 w-4" />
                                Открыть спор
                              </Button>
                            )}
                            <span className="text-sm text-muted-foreground">
                              Скачано: {purchase.downloadCount} раз
                            </span>
                          </div>

                          {/* Dispute Dialog */}
                          {showDisputeDialog === purchase.id && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                              <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full">
                                <h3 className="text-lg font-semibold mb-4">Открыть спор</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Опишите причину открытия спора. Продавец будет уведомлен.
                                </p>
                                <textarea
                                  className="w-full p-3 border rounded-lg mb-4 min-h-[120px]"
                                  placeholder="Опишите проблему..."
                                  value={disputeReason}
                                  onChange={(e) => setDisputeReason(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleOpenDispute(purchase.id)}
                                    disabled={openingDispute === purchase.id}
                                    className="flex-1"
                                  >
                                    {openingDispute === purchase.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Открыть спор"
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setShowDisputeDialog(null)
                                      setDisputeReason("")
                                    }}
                                    className="flex-1"
                                  >
                                    Отмена
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
