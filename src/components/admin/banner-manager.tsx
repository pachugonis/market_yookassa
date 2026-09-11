"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GalleryHorizontal,
  ImagePlus,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Banner {
  id: string
  imageUrl: string
  mobileImageUrl: string | null
  title: string
  link: string | null
  isActive: boolean
}

interface BannerFormData {
  imageUrl: string
  mobileImageUrl: string | null
  title: string
  link: string
  isActive: boolean
}

const EMPTY_FORM: BannerFormData = {
  imageUrl: "",
  mobileImageUrl: null,
  title: "",
  link: "",
  isActive: true,
}

/** Те же типы, что принимает /api/upload/banner, — чтобы не выбирать заведомо отклонённое. */
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif"

/**
 * Поле загрузки картинки с превью в пропорциях карусели: сразу видно,
 * что обрежется, а что нет.
 */
function BannerImageField({
  id,
  label,
  hint,
  aspectClassName,
  value,
  onChange,
  optional,
}: {
  id: string
  label: string
  hint: string
  aspectClassName: string
  value: string | null
  onChange: (value: string | null) => void
  optional?: boolean
}) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const upload = async (file: File) => {
    setIsUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)

      const response = await fetch("/api/upload/banner", { method: "POST", body })
      const data = await response.json()

      if (data.success) {
        onChange(data.data.imageUrl)
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось загрузить картинку",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить картинку",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      // Сброс нужен, чтобы тот же файл можно было выбрать повторно.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground"> — необязательно</span>}
      </Label>

      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary/40",
          aspectClassName
        )}
      >
        {value ? (
          <>
            <Image src={value} alt="" fill sizes="480px" className="object-cover" />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute right-2 top-2 h-7 w-7 rounded-full"
              onClick={() => onChange(null)}
              aria-label="Убрать картинку"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ImagePlus className="h-6 w-6" />
            {isUploading ? "Загрузка..." : "Выбрать файл"}
          </button>
        )}
      </div>

      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload(file)
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{hint}</p>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? "Загрузка..." : "Заменить"}
          </Button>
        )}
      </div>
    </div>
  )
}

export function BannerManager({ banners }: { banners: Banner[] }) {
  const router = useRouter()
  const { toast } = useToast()

  // Локальная копия нужна для мгновенного отклика на перестановку и
  // выключатель: ответа сервера и обновления страницы не ждём.
  const [items, setItems] = useState(banners)
  const [prevBanners, setPrevBanners] = useState(banners)
  if (banners !== prevBanners) {
    setPrevBanners(banners)
    setItems(banners)
  }

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)
  const [formData, setFormData] = useState<BannerFormData>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [deleting, setDeleting] = useState<Banner | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const showError = (description: string) =>
    toast({ title: "Ошибка", description, variant: "destructive" })

  const openCreate = () => {
    setEditing(null)
    setFormData(EMPTY_FORM)
    setIsFormOpen(true)
  }

  const openEdit = (banner: Banner) => {
    setEditing(banner)
    setFormData({
      imageUrl: banner.imageUrl,
      mobileImageUrl: banner.mobileImageUrl,
      title: banner.title,
      link: banner.link ?? "",
      isActive: banner.isActive,
    })
    setIsFormOpen(true)
  }

  const handleSave = async () => {
    if (!formData.imageUrl) {
      showError("Загрузите картинку баннера")
      return
    }
    if (!formData.title.trim()) {
      showError("Укажите подпись баннера")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(
        editing ? `/api/admin/banners/${editing.id}` : "/api/admin/banners",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }
      )
      const data = await response.json()

      if (data.success) {
        toast({
          title: "Готово",
          description: editing ? "Баннер сохранён" : "Баннер добавлен",
        })
        setIsFormOpen(false)
        router.refresh()
      } else {
        showError(data.error || "Не удалось сохранить баннер")
      }
    } catch {
      showError("Не удалось сохранить баннер")
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle = async (banner: Banner, isActive: boolean) => {
    setItems((prev) => prev.map((b) => (b.id === banner.id ? { ...b, isActive } : b)))

    try {
      const response = await fetch(`/api/admin/banners/${banner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error)
      router.refresh()
    } catch {
      setItems((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, isActive: !isActive } : b))
      )
      showError("Не удалось переключить баннер")
    }
  }

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return

    const previous = items
    const reordered = [...items]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    setItems(reordered)

    try {
      const response = await fetch("/api/admin/banners/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((b) => b.id) }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error)
      router.refresh()
    } catch {
      setItems(previous)
      showError("Не удалось сохранить порядок")
    }
  }

  const handleDelete = async () => {
    if (!deleting) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/banners/${deleting.id}`, {
        method: "DELETE",
      })
      const data = await response.json()

      if (data.success) {
        toast({ title: "Готово", description: "Баннер удалён" })
        setDeleting(null)
        router.refresh()
      } else {
        showError(data.error || "Не удалось удалить баннер")
      }
    } catch {
      showError("Не удалось удалить баннер")
    } finally {
      setIsDeleting(false)
    }
  }

  const activeCount = items.filter((b) => b.isActive).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Баннеры</h1>
          <p className="mt-2 text-muted-foreground">
            Карусель вверху главной страницы — и на лендинге, и когда главной
            назначен каталог
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить баннер
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <GalleryHorizontal className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold">Баннеров пока нет</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Пока список пуст, карусель на главной не показывается.
            </p>
          </div>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить первый баннер
          </Button>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            На сайте показано {activeCount} из {items.length}. Порядок в списке —
            порядок в карусели.
          </p>

          <div className="space-y-3">
            {items.map((banner, index) => (
              <Card
                key={banner.id}
                className={cn(
                  "flex flex-col gap-4 p-4 sm:flex-row sm:items-center",
                  !banner.isActive && "opacity-60"
                )}
              >
                <div className="relative aspect-[4/1] w-full shrink-0 overflow-hidden rounded-lg bg-secondary sm:w-56">
                  <Image
                    src={banner.imageUrl}
                    alt={banner.title}
                    fill
                    sizes="(min-width: 640px) 224px, 100vw"
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold break-anywhere">{banner.title}</span>
                    {banner.mobileImageUrl && (
                      <Badge variant="secondary" className="gap-1">
                        <Smartphone className="h-3 w-3" />
                        для телефона
                      </Badge>
                    )}
                  </div>
                  {banner.link ? (
                    <a
                      href={banner.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <span className="truncate">{banner.link}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Без ссылки</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={banner.isActive}
                      onCheckedChange={(checked) => handleToggle(banner, checked)}
                      aria-label={`Показывать баннер «${banner.title}»`}
                    />
                    <span className="text-muted-foreground">
                      {banner.isActive ? "Показан" : "Скрыт"}
                    </span>
                  </label>

                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      aria-label="Выше"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === items.length - 1}
                      aria-label="Ниже"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(banner)}
                      aria-label="Редактировать"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleting(banner)}
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать баннер" : "Новый баннер"}</DialogTitle>
            <DialogDescription>
              Текст и кнопки рисуйте прямо на картинке — карусель показывает
              её как есть.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <BannerImageField
              id="banner-image"
              label="Картинка"
              hint="Пропорции 4:1, например 1920 × 480. JPG, PNG, WebP или GIF до 5 МБ."
              aspectClassName="aspect-[4/1]"
              value={formData.imageUrl || null}
              onChange={(imageUrl) => setFormData({ ...formData, imageUrl: imageUrl ?? "" })}
            />

            <BannerImageField
              id="banner-mobile-image"
              label="Картинка для телефона"
              hint="Пропорции 2:1, например 960 × 480. Без неё на телефоне покажется основная; если версия для телефона есть хотя бы у одного баннера, основные картинки там обрежутся по краям."
              aspectClassName="aspect-[2/1] max-w-xs"
              value={formData.mobileImageUrl}
              onChange={(mobileImageUrl) => setFormData({ ...formData, mobileImageUrl })}
              optional
            />

            <div className="space-y-2">
              <Label htmlFor="banner-title">Подпись</Label>
              <Input
                id="banner-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Скидки до 50% на игры"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                На сайте не видна: её читают программы для незрячих и поисковики.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-link">
                Ссылка
                <span className="font-normal text-muted-foreground"> — необязательно</span>
              </Label>
              <Input
                id="banner-link"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="/products?category=games или https://…"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                Страница сайта начинается с «/». Внешние адреса откроются в новой вкладке.
              </p>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <span>
                <span className="block text-sm font-medium">Показывать на сайте</span>
                <span className="block text-xs text-muted-foreground">
                  Скрытый баннер остаётся в списке — его можно вернуть позже
                </span>
              </span>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(isActive) => setFormData({ ...formData, isActive })}
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Сохранение..." : editing ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить баннер?</AlertDialogTitle>
            <AlertDialogDescription>
              Баннер &laquo;{deleting?.title}&raquo; пропадёт с главной, а его
              картинки будут удалены. Чтобы убрать баннер на время, его можно
              просто скрыть.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Диалог закрываем сами после ответа сервера, иначе
                // ошибка удаления осталась бы незамеченной.
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
