"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "framer-motion"
import { Download, Package, Calendar, FileDown, Loader2 } from "lucide-react"
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
}

export default function LibraryPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

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
        setPurchases(data.data)
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
                        <div className="mt-4 flex items-center gap-4">
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
                          <span className="text-sm text-muted-foreground">
                            Скачано: {purchase.downloadCount} раз
                          </span>
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
