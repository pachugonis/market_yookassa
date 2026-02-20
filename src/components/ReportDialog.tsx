"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Flag, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ReportDialogProps {
  type: "PRODUCT" | "USER" | "REVIEW" | "OTHER"
  reportedId: string
  triggerText?: string
  triggerVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
}

const reasonOptions = [
  { value: "SPAM", label: "Спам" },
  { value: "INAPPROPRIATE_CONTENT", label: "Неподобающий контент" },
  { value: "FRAUD", label: "Мошенничество" },
  { value: "COPYRIGHT", label: "Нарушение авторских прав" },
  { value: "HARASSMENT", label: "Домогательства" },
  { value: "MISLEADING", label: "Вводящая в заблуждение информация" },
  { value: "OTHER", label: "Другое" },
]

export function ReportDialog({
  type,
  reportedId,
  triggerText = "Пожаловаться",
  triggerVariant = "ghost",
}: ReportDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!reason) {
      toast({
        title: "Ошибка",
        description: "Выберите причину жалобы",
        variant: "destructive",
      })
      return
    }

    if (description.length < 10) {
      toast({
        title: "Ошибка",
        description: "Описание должно содержать минимум 10 символов",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)

      const reportData: any = {
        type,
        reason,
        description,
      }

      // Set the appropriate reported ID based on type
      if (type === "PRODUCT") {
        reportData.reportedProductId = reportedId
      } else if (type === "USER") {
        reportData.reportedUserId = reportedId
      } else if (type === "REVIEW") {
        reportData.reportedReviewId = reportedId
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportData),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Успешно",
          description: "Жалоба отправлена администратору",
        })
        setOpen(false)
        setReason("")
        setDescription("")
        // Trigger event to refresh admin sidebar count
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("reportStatusChanged"))
        }
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось отправить жалобу",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error submitting report:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось отправить жалобу",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <Flag className="h-4 w-4 mr-2" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Подать жалобу</DialogTitle>
          <DialogDescription>
            Опишите проблему, и наша команда рассмотрит её в ближайшее время.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Причина жалобы <span className="text-destructive">*</span>
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите причину" />
              </SelectTrigger>
              <SelectContent>
                {reasonOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Описание <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Подробно опишите проблему... (минимум 10 символов)"
              rows={5}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {description.length}/1000 символов
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Отправить жалобу
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
