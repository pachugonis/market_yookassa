"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { motion } from "framer-motion"
import { AlertCircle, Loader2, MessageSquare, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice, formatDate } from "@/lib/utils"

interface Dispute {
  id: string
  reason: string
  status: string
  resolution: string | null
  resolutionNote: string | null
  refundAmount: number | null
  createdAt: string
  resolvedAt: string | null
  buyer: {
    id: string
    name: string
    email: string
  }
  purchase: {
    id: string
    amount: number
    product: {
      id: string
      title: string
      coverImage: string | null
    }
  }
  messages: Array<{
    id: string
    message: string
    createdAt: string
  }>
}

export default function SellerDisputesPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login")
    }
  }, [sessionStatus, router])

  useEffect(() => {
    if (session) {
      fetchDisputes()
    }
  }, [session])

  const fetchDisputes = async () => {
    try {
      console.log("[Seller Disputes] Fetching disputes...")
      const res = await fetch("/api/disputes/seller")
      const data = await res.json()
      console.log("[Seller Disputes] Response:", data)
      if (data.success) {
        console.log("[Seller Disputes] Disputes count:", data.data.length)
        setDisputes(data.data)
      } else {
        console.error("[Seller Disputes] Error:", data.error)
      }
    } catch (error) {
      console.error("[Seller Disputes] Fetch error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "destructive" | "success" | "secondary" }> = {
      OPEN: { label: "Открыт", variant: "default" },
      RESOLVED_REFUNDED: { label: "Возврат", variant: "success" },
      RESOLVED_REJECTED: { label: "Отклонён", variant: "destructive" },
      CLOSED: { label: "Закрыт", variant: "secondary" },
    }

    const config = variants[status] || { label: status, variant: "secondary" }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (sessionStatus === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Споры по продажам</h1>
        <p className="text-muted-foreground">Открытые и завершённые споры покупателей</p>
      </div>

      {disputes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Нет споров</h2>
            <p className="text-muted-foreground">
              У вас пока нет открытых или завершённых споров
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {disputes.map((dispute, index) => (
            <motion.div
              key={dispute.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Cover Image */}
                    <div className="relative w-full md:w-32 h-24 rounded-lg overflow-hidden bg-secondary shrink-0">
                      {dispute.purchase.product.coverImage ? (
                        <Image
                          src={dispute.purchase.product.coverImage}
                          alt={dispute.purchase.product.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10">
                          <span className="text-2xl font-bold text-primary/30">
                            {dispute.purchase.product.title.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {dispute.purchase.product.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Покупатель: {dispute.buyer.name} ({dispute.buyer.email})
                          </p>
                        </div>
                        {getStatusBadge(dispute.status)}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Открыт: {formatDate(new Date(dispute.createdAt))}
                        </div>

                        <div className="p-3 bg-secondary/30 rounded-lg">
                          <p className="text-sm font-medium mb-1">Причина:</p>
                          <p className="text-sm text-muted-foreground">{dispute.reason}</p>
                        </div>

                        {dispute.status !== "OPEN" && dispute.resolutionNote && (
                          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                            <p className="text-sm font-medium mb-1">Решение:</p>
                            <p className="text-sm">{dispute.resolutionNote}</p>
                            {dispute.refundAmount && (
                              <p className="text-sm font-medium text-red-600 mt-2">
                                Возврат: {formatPrice(dispute.refundAmount)}
                              </p>
                            )}
                          </div>
                        )}

                        {dispute.status === "OPEN" && (
                          <Button
                            onClick={() => router.push(`/dashboard/disputes/${dispute.id}`)}
                            className="mt-2"
                          >
                            <MessageSquare className="h-4 w-4" />
                            Открыть чат
                            {dispute.messages.length > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {dispute.messages.length}
                              </Badge>
                            )}
                          </Button>
                        )}
                      </div>
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
