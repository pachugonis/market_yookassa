"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Upload, Loader2, ImageIcon, FileUp, X, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"

interface Subcategory {
  id: string
  name: string
  slug: string
}

interface Category {
  id: string
  name: string
  slug: string
  subcategories?: Subcategory[]
}

export default function NewProductPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [maxFileSize, setMaxFileSize] = useState(500)

  const [selectedParentCategory, setSelectedParentCategory] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    categoryId: "",
    coverImage: "",
    fileUrl: "",
    fileName: "",
    fileSize: 0,
    hasLicenseKeys: false,
    licenseKeys: "" as string,
  })

  useEffect(() => {
    fetchCategories()
    fetchSettings()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      const data = await res.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      if (data.success && data.data?.maxFileSize) {
        setMaxFileSize(data.data.maxFileSize)
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    }
  }

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "product" | "cover"
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    const setter = type === "cover" ? setUploadingCover : setUploadingFile
    setter(true)

    const formDataUpload = new FormData()
    formDataUpload.append("file", file)
    formDataUpload.append("type", type)

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      })

      const data = await res.json()

      if (data.success) {
        if (type === "cover") {
          setFormData((prev) => ({ ...prev, coverImage: data.data.fileUrl }))
        } else {
          setFormData((prev) => ({
            ...prev,
            fileUrl: data.data.fileUrl,
            fileName: data.data.fileName,
            fileSize: data.data.fileSize,
          }))
        }
        toast({ title: "Файл загружен" })
      } else {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" })
    } finally {
      setter(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.fileUrl) {
      toast({ title: "Загрузите файл товара", variant: "destructive" })
      return
    }

    if (formData.hasLicenseKeys && !formData.licenseKeys.trim()) {
      toast({ title: "Добавьте хотя бы один ключ лицензии", variant: "destructive" })
      return
    }

    setIsLoading(true)

    try {
      const licenseKeysArray = formData.hasLicenseKeys 
        ? formData.licenseKeys.split('\n').map(k => k.trim()).filter(k => k.length > 0)
        : []

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: parseInt(formData.price),
          licenseKeys: licenseKeysArray,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast({ title: "Товар создан!" })
        router.push("/dashboard/products")
      } else {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Ошибка при создании товара", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold mb-2">Новый товар</h1>
        <p className="text-muted-foreground mb-8">
          Заполните информацию о вашем цифровом товаре
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Название товара</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Например: Набор иконок для веб-сайта"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Подробное описание товара..."
                  rows={5}
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Цена (руб.)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="990"
                    min="1"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Категория</Label>
                  <Select
                    value={selectedParentCategory}
                    onValueChange={(value) => {
                      setSelectedParentCategory(value)
                      const category = categories.find(cat => cat.id === value)
                      setSelectedCategory(category || null)
                      
                      if (category?.subcategories && category.subcategories.length > 0) {
                        setSubcategories(category.subcategories)
                        setFormData({ ...formData, categoryId: "" })
                      } else {
                        setSubcategories([])
                        setFormData({ ...formData, categoryId: value })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {subcategories.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">Подкатегория</Label>
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите подкатегорию" />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategories.map((subcat) => (
                          <SelectItem key={subcat.id} value={subcat.id}>
                            {subcat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cover Image */}
          <Card>
            <CardHeader>
              <CardTitle>Обложка</CardTitle>
            </CardHeader>
            <CardContent>
              {formData.coverImage ? (
                <div className="relative">
                  <img
                    src={formData.coverImage}
                    alt="Cover"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => setFormData({ ...formData, coverImage: "" })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "cover")}
                  />
                  {uploadingCover ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Нажмите для загрузки изображения
                      </span>
                    </>
                  )}
                </label>
              )}
            </CardContent>
          </Card>

          {/* Product File */}
          <Card>
            <CardHeader>
              <CardTitle>Файл товара</CardTitle>
            </CardHeader>
            <CardContent>
              {formData.fileUrl ? (
                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileUp className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{formData.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(formData.fileSize)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFormData({ ...formData, fileUrl: "", fileName: "", fileSize: 0 })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "product")}
                  />
                  {uploadingFile ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Загрузите файл для скачивания (до {maxFileSize}MB)
                      </span>
                    </>
                  )}
                </label>
              )}
            </CardContent>
          </Card>

          {/* License Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Лицензионные ключи
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasLicenseKeys"
                  checked={formData.hasLicenseKeys}
                  onChange={(e) => setFormData({ ...formData, hasLicenseKeys: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="hasLicenseKeys" className="cursor-pointer">
                  Этот товар использует лицензионные ключи
                </Label>
              </div>

              {formData.hasLicenseKeys && (
                <div className="space-y-2">
                  <Label htmlFor="licenseKeys">
                    Ключи (каждый ключ с новой строки)
                  </Label>
                  <Textarea
                    id="licenseKeys"
                    value={formData.licenseKeys}
                    onChange={(e) => setFormData({ ...formData, licenseKeys: e.target.value })}
                    placeholder="XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY\nZZZZ-ZZZZ-ZZZZ-ZZZZ"
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-muted-foreground">
                    Добавлено ключей: {formData.licenseKeys.split('\n').filter(k => k.trim().length > 0).length}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.categoryId}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                "Создать товар"
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
