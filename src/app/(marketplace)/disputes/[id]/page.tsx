"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowLeft, Send, Loader2, Calendar, AlertCircle } from "lucide-react"
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
    product: {
      id: string
      title: string
      coverImage: string | null
      seller: {
        id: string
        name: string
      }
    }
  }
  buyer?: {
    id: string
    name: string
  }
}

export default function DisputeChatPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const disputeId = params.id as string

  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (disputeId) {
      fetchDispute()
      fetchMessages()
      
      // Poll for new messages every 5 seconds
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

  const handleCloseDispute = async () => {
    if (!confirm("Вы уверены, что хотите закрыть спор? Это действие нельзя отменить.")) {
      return
    }

    setIsClosing(true)
    try {
      const res = await fetch(`/api/disputes/${disputeId}/close`, {
        method: "POST",
      })

      const data = await res.json()

      if (data.success) {
        alert(data.message || "Спор закрыт")
        router.push("/disputes")
      } else {
        alert(data.error || "Ошибка при закрытии спора")
      }
    } catch (error) {
      console.error("Error closing dispute:", error)
      alert("Ошибка при закрытии спора")
    } finally {
      setIsClosing(false)
    }
  }

  const fetchDispute = async () => {
    try {
      const res = await fetch(`/api/disputes`)
      const data = await res.json()
      if (data.success) {
        const foundDispute = data.data.find((d: any) => d.id === disputeId)
        if (foundDispute) {
          // For buyer disputes, the buyer is the current user
          setDispute({
            ...foundDispute,
            buyer: session?.user ? { id: session.user.id, name: session.user.name } : foundDispute.buyer
          })
        }
      }
    } catch (error) {
      console.error("Error fetching dispute:", error)
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
      console.log("[Client] Sending message to dispute:", disputeId)
      console.log("[Client] Message content:", newMessage)
      
      const res = await fetch(`/api/disputes/${disputeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage }),
      })

      console.log("[Client] Response status:", res.status)
      console.log("[Client] Response ok:", res.ok)
      
      const text = await res.text()
      console.log("[Client] Response text:", text)
      
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error("[Client] Failed to parse JSON:", e)
        alert("Ошибка: некорректный ответ сервера")
        return
      }
      
      console.log("[Client] Response data:", data)

      if (data.success) {
        setNewMessage("")
        fetchMessages()
      } else {
        console.error("[Client] Error from API:", data.error)
        alert(data.error || "Ошибка при отправке сообщения")
      }
    } catch (error) {
      console.error("[Client] Catch error:", error)
      alert("Ошибка при отправке сообщения")
    } finally {
      setIsSending(false)
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
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const isMyMessage = (message: Message) => {
    return message.sender.id === session?.user?.id
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </Button>

      {/* Dispute Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">{dispute.purchase.product.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Продавец: {dispute.purchase.product.seller.name}
              </p>
            </div>
            {getStatusBadge(dispute.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
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
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0" />
                <div className="text-sm flex-1">
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">Спор активен</p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Сделка на паузе. Средства заблокированы до разрешения спора.
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                    Если проблема решена, вы можете закрыть спор в чате ниже.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Чат</CardTitle>
            {dispute.status === "OPEN" && (
              <Button
                variant="outline"
                onClick={handleCloseDispute}
                disabled={isClosing}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                {isClosing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Закрываем...
                  </>
                ) : (
                  "Закрыть спор"
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-4 max-h-[500px] overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Сообщений пока нет. Начните диалог!
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
    </div>
  )
}
