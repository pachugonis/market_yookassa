"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { ArrowLeft, Send, Loader2, Calendar, AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatPrice, formatDate } from "@/lib/utils"

interface Message {
  id: string
  message: string
  isFromBuyer: boolean
  createdAt: string
  sender: {
    id: string
    name: string
    avatar: string | null
  }
}

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
    sellerEarnings: number
    product: {
      id: string
      title: string
      coverImage: string | null
    }
  }
  buyer: {
    id: string
    name: string
    email: string
  }
}

export default function SellerDisputeChatPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const disputeId = params.id as string

  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [showResolveDialog, setShowResolveDialog] = useState(false)
  const [resolutionType, setResolutionType] = useState<"REFUND_BUYER" | "REJECT_DISPUTE" | "PARTIAL_REFUND">("REJECT_DISPUTE")
  const [resolutionNote, setResolutionNote] = useState("")
  const [partialAmount, setPartialAmount] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (disputeId) {
      fetchDispute()
      fetchMessages()
      
      const interval = setInterval(fetchMessages, 5000)
      return () => clearInterval(interval)
    }
  }, [disputeId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchDispute = async () => {
    try {
      console.log("[Seller Dispute Chat] Fetching dispute:", disputeId)
      const res = await fetch(`/api/disputes/seller`)
      const data = await res.json()
      console.log("[Seller Dispute Chat] Response:", data)
      if (data.success) {
        console.log("[Seller Dispute Chat] All disputes:", data.data.length)
        const foundDispute = data.data.find((d: Dispute) => d.id === disputeId)
        console.log("[Seller Dispute Chat] Found dispute:", !!foundDispute)
        if (foundDispute) {
          console.log("[Seller Dispute Chat] Dispute data:", foundDispute)
          setDispute(foundDispute)
        } else {
          console.error("[Seller Dispute Chat] Dispute not found in list")
        }
      } else {
        console.error("[Seller Dispute Chat] API error:", data.error)
      }
    } catch (error) {
      console.error("[Seller Dispute Chat] Fetch error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/disputes/${disputeId}/messages`)
      const data = await res.json()
      if (data.success) {
        setMessages(data.data)
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    try {
      console.log("[Seller Client] Sending message to dispute:", disputeId)
      console.log("[Seller Client] Message content:", newMessage)
      
      const res = await fetch(`/api/disputes/${disputeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage }),
      })

      console.log("[Seller Client] Response status:", res.status)
      
      const data = await res.json()
      console.log("[Seller Client] Response data:", data)

      if (data.success) {
        setNewMessage("")
        fetchMessages()
      } else {
        console.error("[Seller Client] Error from API:", data.error)
        alert(data.error || "Ошибка при отправке сообщения")
      }
    } catch (error) {
      console.error("[Seller Client] Catch error:", error)
      alert("Ошибка при отправке сообщения")
    } finally {
      setIsSending(false)
    }
  }

  const handleResolve = async () => {
    if (!resolutionNote.trim()) {
      alert("Пожалуйста, укажите комментарий к решению")
      return
    }

    if (resolutionType === "PARTIAL_REFUND") {
      const amount = parseInt(partialAmount)
      if (!amount || amount <= 0 || amount > dispute!.purchase.amount) {
        alert("Неверная сумма частичного возврата")
        return
      }
    }

    setIsResolving(true)
    try {
      const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution: resolutionType,
          resolutionNote,
          refundAmount: resolutionType === "PARTIAL_REFUND" ? parseInt(partialAmount) : null,
        }),
      })

      const data = await res.json()

      if (data.success) {
        alert(data.message || "Спор разрешён")
        router.push("/dashboard/disputes")
      } else {
        alert(data.error || "Ошибка при разрешении спора")
      }
    } catch (error) {
      console.error("Error resolving dispute:", error)
      alert("Ошибка при разрешении спора")
    } finally {
      setIsResolving(false)
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

  if (isLoading || !dispute) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const isMyMessage = (message: Message) => {
    return message.sender.id === session?.user?.id
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.push("/dashboard/disputes")}
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </Button>

      {/* Dispute Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">{dispute.purchase.product.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Покупатель: {dispute.buyer.name} ({dispute.buyer.email})
              </p>
            </div>
            {getStatusBadge(dispute.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Сумма покупки</p>
                <p className="font-semibold">{formatPrice(dispute.purchase.amount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ваш доход</p>
                <p className="font-semibold text-green-600">{formatPrice(dispute.purchase.sellerEarnings)}</p>
              </div>
            </div>

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
          </div>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Чат с покупателем</CardTitle>
            {dispute.status === "OPEN" && (
              <Button
                onClick={() => setShowResolveDialog(true)}
                variant="outline"
              >
                Разрешить спор
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-4 max-h-[500px] overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Сообщений пока нет
              </p>
            ) : (
              messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMyMessage(message) ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[70%] ${isMyMessage(message) ? "bg-primary text-primary-foreground" : "bg-secondary"} rounded-lg p-3`}>
                    <p className="text-sm font-medium mb-1">{message.sender.name}</p>
                    <p className="text-sm">{message.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.createdAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {dispute.status === "OPEN" && (
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-1 p-3 border rounded-lg"
                disabled={isSending}
              />
              <Button type="submit" disabled={isSending || !newMessage.trim()}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Отправить
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      {showResolveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Разрешить спор</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Тип решения</label>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value as any)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="REJECT_DISPUTE">Отклонить спор</option>
                  <option value="REFUND_BUYER">Полный возврат</option>
                  <option value="PARTIAL_REFUND">Частичный возврат</option>
                </select>
              </div>

              {resolutionType === "PARTIAL_REFUND" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Сумма возврата (₽)</label>
                  <input
                    type="number"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="0"
                    max={dispute.purchase.amount}
                    className="w-full p-2 border rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Максимум: {formatPrice(dispute.purchase.amount)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Комментарий</label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Объясните ваше решение..."
                  className="w-full p-3 border rounded-lg min-h-[100px]"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleResolve}
                  disabled={isResolving}
                  className="flex-1"
                >
                  {isResolving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Подтвердить"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowResolveDialog(false)
                    setResolutionNote("")
                    setPartialAmount("")
                  }}
                  className="flex-1"
                >
                  Отмена
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
