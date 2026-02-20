"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { motion } from "framer-motion"
import { AlertCircle, Loader2, MessageSquare, Calendar, Package } from "lucide-react"
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
  purchase: {
    id: string
    amount: number
    product: {
      id: string
      title: string
      coverImage: string | null
      seller: {
        id: string
        name: string
        email: string
      }
    }
  }
  messages: Array<{
    id: string
    message: string
    createdAt: string
  }>
}

export default function DisputesPage() {
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
      const res = await fetch("/api/disputes")
      const data = await res.json()
      if (data.success) {
        setDisputes(data.data)
      }
    } catch (error) {
      console.error("Error fetching disputes:", error)
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
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Мои споры</h1>
        <p className="text-muted-foreground">
          Открытые и завершённые споры по вашим покупкам
        </p>
      </motion.div>

      {disputes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Нет споров</h2>
          <p className="text-muted-foreground mb-6">
            У вас пока нет открытых или завершённых споров
          </p>
          <Button onClick={() => router.push("/library")}>
            Перейти в библиотеку
          </Button>
        </motion.div>
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
                <CardContent className="p-4 md:p-6">
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
                            Продавец: {dispute.purchase.product.seller.name}
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
                              <p className="text-sm font-medium text-green-600 mt-2">
                                Возвращено: {formatPrice(dispute.refundAmount)}
                              </p>
                            )}
                          </div>
                        )}

                        {dispute.status === "OPEN" && (
                          <Button
                            onClick={() => router.push(`/disputes/${dispute.id}`)}
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
