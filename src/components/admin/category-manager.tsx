"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Plus, Pencil, Trash2, ChevronRight, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

interface Category {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
  parentId: string | null
  subcategories?: Category[]
  _count: {
    products: number
  }
}

interface CategoryManagerProps {
  categories: Category[]
}

export function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // Flatten categories to show parent and subcategories in order
  const flattenedCategories = categories.reduce((acc, category) => {
    if (!category.parentId) {
      acc.push(category)
      if (category.subcategories) {
        category.subcategories.forEach(sub => acc.push(sub))
      }
    }
    return acc
  }, [] as Category[])

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    icon: "",
    description: "",
    parentId: null as string | null,
  })

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      icon: "",
      description: "",
      parentId: null,
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append("file", file)

      const response = await fetch("/api/upload/category-icon", {
        method: "POST",
        body: uploadFormData,
      })

      const data = await response.json()

      if (data.success) {
        setFormData({ ...formData, icon: data.data.iconUrl })
        toast({
          title: "Успех",
          description: "Иконка загружена",
        })
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Ошибка загрузки иконки",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Ошибка загрузки иконки",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const removeIcon = () => {
    setFormData({ ...formData, icon: "" })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    if (editFileInputRef.current) {
      editFileInputRef.current.value = ""
    }
  }

  const isImageIcon = (icon: string) => {
    return icon.startsWith("/") || icon.startsWith("http")
  }

  const handleCreate = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: "Категория создана",
        })
        setIsCreateOpen(false)
        resetForm()
        router.refresh()
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Ошибка создания категории",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Ошибка создания категории",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedCategory) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/categories/${selectedCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: "Категория обновлена",
        })
        setIsEditOpen(false)
        setSelectedCategory(null)
        resetForm()
        router.refresh()
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Ошибка обновления категории",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Ошибка обновления категории",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedCategory) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/categories/${selectedCategory.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: "Категория удалена",
        })
        setIsDeleteOpen(false)
        setSelectedCategory(null)
        router.refresh()
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Ошибка удаления категории",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Ошибка удаления категории",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const openEditDialog = (category: Category) => {
    setSelectedCategory(category)
    setFormData({
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      description: category.description || "",
      parentId: category.parentId,
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (category: Category) => {
    setSelectedCategory(category)
    setIsDeleteOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Категории</h1>
          <p className="text-muted-foreground mt-2">Управление категориями товаров</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить категорию
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать категорию</DialogTitle>
              <DialogDescription>
                Добавьте новую категорию товаров
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Программы"
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="software"
                />
              </div>
              <div>
                <Label htmlFor="icon">Иконка</Label>
                <div className="space-y-3">
                  {formData.icon && (
                    <div className="relative inline-block">
                      {isImageIcon(formData.icon) ? (
                        <div className="relative w-20 h-20 rounded-lg border-2 border-border overflow-hidden">
                          <Image
                            src={formData.icon}
                            alt="Icon preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg border-2 border-border flex items-center justify-center text-3xl">
                          {formData.icon}
                        </div>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={removeIcon}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      id="icon"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      placeholder="💻 или введите путь к изображению"
                      className="flex-1"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFileChange(e)}
                      accept="image/*"
                      className="hidden"
                      id="icon-file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploading ? "Загрузка..." : "Загрузить"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Вы можете загрузить изображение или использовать эмодзи/текст
                  </p>
                </div>
              </div>
              <div>
                <Label htmlFor="parent">Родительская категория (опционально)</Label>
                <Select
                  value={formData.parentId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, parentId: value === "none" ? null : value })}
                >
                  <SelectTrigger id="parent">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без родителя (основная категория)</SelectItem>
                    {categories.filter(c => !c.parentId).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Программное обеспечение и приложения"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading ? "Создание..." : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left p-4 font-medium">Иконка</th>
                <th className="text-left p-4 font-medium">Название</th>
                <th className="text-left p-4 font-medium">Slug</th>
                <th className="text-left p-4 font-medium">Описание</th>
                <th className="text-left p-4 font-medium">Товаров</th>
                <th className="text-right p-4 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {flattenedCategories.map((category) => (
                <tr key={category.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="p-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                      {isImageIcon(category.icon) ? (
                        <Image
                          src={category.icon}
                          alt={category.name}
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-xl">{category.icon}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {category.parentId && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-4" />
                      )}
                      <span className="font-semibold">{category.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <code className="text-xs bg-secondary px-2 py-1 rounded">/{category.slug}</code>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">{category.description}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-medium">{category._count.products}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openDeleteDialog(category)}
                        disabled={category._count.products > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать категорию</DialogTitle>
            <DialogDescription>
              Изменить данные категории
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Название</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-slug">Slug (URL)</Label>
              <Input
                id="edit-slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-icon">Иконка</Label>
              <div className="space-y-3">
                {formData.icon && (
                  <div className="relative inline-block">
                    {isImageIcon(formData.icon) ? (
                      <div className="relative w-20 h-20 rounded-lg border-2 border-border overflow-hidden">
                        <Image
                          src={formData.icon}
                          alt="Icon preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-border flex items-center justify-center text-3xl">
                        {formData.icon}
                      </div>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={removeIcon}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    id="edit-icon"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="💻 или введите путь к изображению"
                    className="flex-1"
                  />
                  <input
                    type="file"
                    ref={editFileInputRef}
                    onChange={(e) => handleFileChange(e)}
                    accept="image/*"
                    className="hidden"
                    id="edit-icon-file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? "Загрузка..." : "Загрузить"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Вы можете загрузить изображение или использовать эмодзи/текст
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-parent">Родительская категория (опционально)</Label>
              <Select
                value={formData.parentId || "none"}
                onValueChange={(value) => setFormData({ ...formData, parentId: value === "none" ? null : value })}
              >
                <SelectTrigger id="edit-parent">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без родителя (основная категория)</SelectItem>
                  {categories.filter(c => !c.parentId && c.id !== selectedCategory?.id).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-description">Описание</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleEdit} disabled={isLoading}>
              {isLoading ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить категорию &ldquo;{selectedCategory?.name}&rdquo;?
              {selectedCategory && selectedCategory._count.products > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  Невозможно удалить категорию, в которой есть товары ({selectedCategory._count.products}).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading || (selectedCategory?._count.products ?? 0) > 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Статистика категорий</h3>
        <div className="space-y-3">
          {categories
            .sort((a, b) => b._count.products - a._count.products)
            .map((category) => (
              <div key={category.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  {isImageIcon(category.icon) ? (
                    <div className="relative w-6 h-6 rounded overflow-hidden">
                      <Image
                        src={category.icon}
                        alt={category.name}
                        width={24}
                        height={24}
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <span className="text-xl">{category.icon}</span>
                  )}
                  <span className="font-medium">{category.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-64 bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${Math.min((category._count.products / Math.max(...categories.map((c) => c._count.products))) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">
                    {category._count.products}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )
}
