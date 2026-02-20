"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Save, Trash2, RefreshCw, User, Package, MessageSquare } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"

interface Report {
  id: string
  type: string
  reason: string
  description: string
  status: string
  adminNote?: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  reportedUserId?: string
  reportedProductId?: string
  reportedReviewId?: string
  reporter: {
    id: string
    name: string
    email: string
    role: string
    avatar?: string
  }
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500",
  UNDER_REVIEW: "bg-blue-500",
  RESOLVED: "bg-green-500",
  REJECTED: "bg-red-500",
  CLOSED: "bg-gray-500",
}

const statusLabels: Record<string, string> = {
  PENDING: "Ожидает",
  UNDER_REVIEW: "На рассмотрении",
  RESOLVED: "Решена",
  REJECTED: "Отклонена",
  CLOSED: "Закрыта",
}

const typeLabels: Record<string, string> = {
  PRODUCT: "Товар",
  USER: "Пользователь",
  REVIEW: "Отзыв",
  OTHER: "Другое",
}

const reasonLabels: Record<string, string> = {
  SPAM: "Спам",
  INAPPROPRIATE_CONTENT: "Неподобающий контент",
  FRAUD: "Мошенничество",
  COPYRIGHT: "Нарушение авторских прав",
  HARASSMENT: "Домогательства",
  MISLEADING: "Вводящая в заблуждение информация",
  OTHER: "Другое",
}

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { toast } = useToast()
  const resolvedParams = React.use(params)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState("")
  const [adminNote, setAdminNote] = useState("")

  const fetchReport = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/reports/${resolvedParams.id}`)
      const data = await response.json()

      if (response.ok) {
        setReport(data.report)
        setStatus(data.report.status)
        setAdminNote(data.report.adminNote || "")
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось загрузить жалобу",
          variant: "destructive",
        })
        router.push("/admin/reports")
      }
    } catch (error) {
      console.error("Error fetching report:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить жалобу",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [resolvedParams.id])

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/admin/reports/${resolvedParams.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Успешно",
          description: "Жалоба обновлена",
        })
        setReport(data.report)
        // Trigger event to refresh sidebar count
        window.dispatchEvent(new CustomEvent("reportStatusChanged"))
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось обновить жалобу",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating report:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось обновить жалобу",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Вы уверены, что хотите удалить эту жалобу?")) return

    try {
      const response = await fetch(`/api/admin/reports/${resolvedParams.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Успешно",
          description: "Жалоба удалена",
        })
        // Trigger event to refresh sidebar count
        window.dispatchEvent(new CustomEvent("reportStatusChanged"))
        router.push("/admin/reports")
      } else {
        const data = await response.json()
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось удалить жалобу",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting report:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось удалить жалобу",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin/reports")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Детали жалобы</h1>
            <p className="text-muted-foreground mt-1">ID: {report.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Удалить
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Report Details */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Информация о жалобе</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Тип</label>
              <div className="flex items-center gap-2 mt-1">
                {report.type === "PRODUCT" && <Package className="h-4 w-4" />}
                {report.type === "USER" && <User className="h-4 w-4" />}
                {report.type === "REVIEW" && <MessageSquare className="h-4 w-4" />}
                <Badge variant="outline">{typeLabels[report.type]}</Badge>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Причина</label>
              <p className="mt-1">{reasonLabels[report.reason]}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Описание</label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{report.description}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Создана</label>
              <p className="mt-1 text-sm">
                {format(new Date(report.createdAt), "d MMMM yyyy, HH:mm", { locale: ru })}
              </p>
            </div>

            {report.resolvedAt && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Решена</label>
                <p className="mt-1 text-sm">
                  {format(new Date(report.resolvedAt), "d MMMM yyyy, HH:mm", { locale: ru })}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Reporter Info */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Автор жалобы</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {report.reporter.avatar ? (
                <img 
                  src={report.reporter.avatar} 
                  alt={report.reporter.name}
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <p className="font-medium">{report.reporter.name}</p>
                <p className="text-sm text-muted-foreground">{report.reporter.email}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Роль</label>
              <p className="mt-1">{report.reporter.role}</p>
            </div>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(`/admin/users?id=${report.reporter.id}`)}
            >
              <User className="h-4 w-4 mr-2" />
              Профиль пользователя
            </Button>
          </div>
        </Card>
      </div>

      {/* Management */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Управление жалобой</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Статус</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Ожидает</SelectItem>
                <SelectItem value="UNDER_REVIEW">На рассмотрении</SelectItem>
                <SelectItem value="RESOLVED">Решена</SelectItem>
                <SelectItem value="REJECTED">Отклонена</SelectItem>
                <SelectItem value="CLOSED">Закрыта</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Заметка администратора</label>
            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Добавьте заметку о решении..."
              rows={4}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Сохранить изменения
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
