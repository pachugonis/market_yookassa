"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion } from "framer-motion"
import { Upload, Loader2, ImageIcon, FileUp, X, ArrowLeft } from "lucide-react"
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
import Link from "next/link"

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

interface Product {
  id: string
  title: string
  description: string
  price: number
  categoryId: string
  coverImage: string | null
  fileUrl: string
  fileName: string
  fileSize: number
  status: string
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [selectedParentCategory, setSelectedParentCategory] = useState<string>("")
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    categoryId: "",
    coverImage: "",
    status: "ACTIVE",
  })

  const [productFile, setProductFile] = useState({
    fileName: "",
    fileSize: 0,
  })

  useEffect(() => {
    fetchCategories()
    fetchProduct()
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

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/products/${productId}`)
      const data = await res.json()

      if (data.success) {
        const product: Product = data.data
        setFormData({
          title: product.title,
          description: product.description,
          price: product.price.toString(),
          categoryId: product.categoryId,
          coverImage: product.coverImage || "",
          status: product.status,
        })
        setProductFile({
          fileName: product.fileName,
          fileSize: product.fileSize,
        })
        
        // Find parent category and subcategories if the product's category is a subcategory
        setTimeout(() => {
          const allCategories = categories
          const parentCat = allCategories.find(cat => 
            cat.subcategories?.some(sub => sub.id === product.categoryId)
          )
          if (parentCat) {
            setSelectedParentCategory(parentCat.id)
            setSubcategories(parentCat.subcategories || [])
          } else {
            setSelectedParentCategory(product.categoryId)
            setSubcategories([])
          }
        }, 100)
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: data.error || "Товар не найден",
        })
        router.push("/dashboard/products")
      }
    } catch (error) {
      console.error("Error fetching product:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить товар",
      })
      router.push("/dashboard/products")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCover(true)

    const formDataUpload = new FormData()
    formDataUpload.append("file", file)
    formDataUpload.append("type", "cover")

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      })

      const data = await res.json()

      if (data.success) {
        setFormData((prev) => ({ ...prev, coverImage: data.data.fileUrl }))
        toast({ title: "Обложка обновлена" })
      } else {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" })
    } finally {
      setUploadingCover(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSaving(true)

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          price: parseInt(formData.price),
          categoryId: formData.categoryId,
          coverImage: formData.coverImage || null,
          status: formData.status,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast({ title: "Товар обновлен!" })
        router.push("/dashboard/products")
      } else {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Ошибка при обновлении товара", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Редактировать товар</h1>
            <p className="text-muted-foreground">
              Измените информацию о вашем товаре
            </p>
          </div>
        </div>

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
                      
                      if (category?.subcategories && category.subcategories.length > 0) {
                        setSubcategories(category.subcategories)
                        // Don't reset categoryId if it's already a subcategory of this parent
                        if (!category.subcategories.some(sub => sub.id === formData.categoryId)) {
                          setFormData({ ...formData, categoryId: "" })
                        }
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

              <div className="space-y-2">
                <Label htmlFor="status">Статус</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Активен</SelectItem>
                    <SelectItem value="DRAFT">Черновик</SelectItem>
                    <SelectItem value="INACTIVE">Неактивен</SelectItem>
                  </SelectContent>
                </Select>
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
                    onChange={handleFileUpload}
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

          {/* Product File Info (Read-only) */}
          <Card>
            <CardHeader>
              <CardTitle>Файл товара</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl">
                <FileUp className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{productFile.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(productFile.fileSize)}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Только для чтения
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Файл товара нельзя изменить после создания
              </p>
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
              disabled={isSaving || !formData.categoryId}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Сохранение...
                </>
              ) : (
                "Сохранить изменения"
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
