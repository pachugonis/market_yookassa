"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Eye, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface Report {
  id: string
  type: string
  reason: string
  description: string
  status: string
  createdAt: string
  reporter: {
    name: string
    email: string
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

export default function AdminReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  const fetchReports = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter)
      if (typeFilter && typeFilter !== "all") params.append("type", typeFilter)

      const response = await fetch(`/api/admin/reports?${params}`)
      const data = await response.json()

      if (response.ok) {
        setReports(data.reports)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("Error fetching reports:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [pagination.page, statusFilter, typeFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Жалобы и репорты</h1>
          <p className="text-muted-foreground mt-2">Управление жалобами пользователей</p>
        </div>
        <Button onClick={fetchReports} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Статус</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="PENDING">Ожидает</SelectItem>
                <SelectItem value="UNDER_REVIEW">На рассмотрении</SelectItem>
                <SelectItem value="RESOLVED">Решена</SelectItem>
                <SelectItem value="REJECTED">Отклонена</SelectItem>
                <SelectItem value="CLOSED">Закрыта</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Тип</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="PRODUCT">Товар</SelectItem>
                <SelectItem value="USER">Пользователь</SelectItem>
                <SelectItem value="REVIEW">Отзыв</SelectItem>
                <SelectItem value="OTHER">Другое</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Reports List */}
      <Card className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Жалобы не найдены</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="border rounded-lg p-4 hover:bg-secondary/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/admin/reports/${report.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={statusColors[report.status]}>
                        {statusLabels[report.status]}
                      </Badge>
                      <Badge variant="outline">{typeLabels[report.type]}</Badge>
                      <Badge variant="secondary">{reasonLabels[report.reason]}</Badge>
                    </div>
                    <p className="text-sm mb-2 line-clamp-2">{report.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>От: {report.reporter.name}</span>
                      <span>•</span>
                      <span>{format(new Date(report.createdAt), "d MMMM yyyy, HH:mm", { locale: ru })}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              Страница {pagination.page} из {pagination.totalPages} ({pagination.total} жалоб)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              >
                Назад
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              >
                Вперёд
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
