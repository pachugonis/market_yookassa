"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion } from "framer-motion"
import { Upload, Loader2, ImageIcon, FileUp, X, ArrowLeft, Key, Plus, Check, Trash2, Edit2, Save } from "lucide-react"
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
import { ImageCropper } from "@/components/ui/image-cropper"
import { MultiImageUpload } from "@/components/ui/multi-image-upload"

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
  hasLicenseKeys: boolean
}

interface LicenseKey {
  id: string
  key: string
  isSold: boolean
  soldAt: string | null
  createdAt: string
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [selectedParentCategory, setSelectedParentCategory] = useState<string>("")
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [productImages, setProductImages] = useState<Array<{ id: string; imageUrl: string; order: number }>>([])
  const [licenseKeys, setLicenseKeys] = useState<LicenseKey[]>([])
  const [licenseKeyStats, setLicenseKeyStats] = useState({ total: 0, available: 0, sold: 0 })
  const [newKeysText, setNewKeysText] = useState("")
  const [addingKeys, setAddingKeys] = useState(false)
  const [showAddKeys, setShowAddKeys] = useState(false)
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null)
  const [editingKeyValue, setEditingKeyValue] = useState("")
  const [updatingKey, setUpdatingKey] = useState(false)
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null)

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
    fetchProductImages()
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
        
        // Fetch license keys if product has them
        if (product.hasLicenseKeys) {
          fetchLicenseKeys()
        }
        
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

  const fetchProductImages = async () => {
    try {
      const res = await fetch(`/api/products/${productId}/images`)
      const data = await res.json()
      if (data.success) {
        setProductImages(data.data)
      }
    } catch (error) {
      console.error("Error fetching product images:", error)
    }
  }

  const fetchLicenseKeys = async () => {
    try {
      const res = await fetch(`/api/products/${productId}/license-keys`)
      const data = await res.json()
      if (data.success) {
        setLicenseKeys(data.data.keys)
        setLicenseKeyStats(data.data.stats)
      }
    } catch (error) {
      console.error("Error fetching license keys:", error)
    }
  }

  const handleAddKeys = async () => {
    if (!newKeysText.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите ключи",
      })
      return
    }

    setAddingKeys(true)
    try {
      const keys = newKeysText.split('\n').filter(k => k.trim().length > 0)
      const res = await fetch(`/api/products/${productId}/license-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: data.message,
        })
        setNewKeysText("")
        setShowAddKeys(false)
        fetchLicenseKeys()
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: data.error,
        })
      }
    } catch (error) {
      console.error("Error adding keys:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось добавить ключи",
      })
    } finally {
      setAddingKeys(false)
    }
  }

  const handleEditKey = (key: LicenseKey) => {
    setEditingKeyId(key.id)
    setEditingKeyValue(key.key)
  }

  const handleSaveKey = async (keyId: string) => {
    if (!editingKeyValue.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Ключ не может быть пустым",
      })
      return
    }

    setUpdatingKey(true)
    try {
      const res = await fetch(`/api/products/${productId}/license-keys`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId, newKey: editingKeyValue }),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: data.message,
        })
        setEditingKeyId(null)
        setEditingKeyValue("")
        fetchLicenseKeys()
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: data.error,
        })
      }
    } catch (error) {
      console.error("Error updating key:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить ключ",
      })
    } finally {
      setUpdatingKey(false)
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот ключ?")) {
      return
    }

    setDeletingKeyId(keyId)
    try {
      const res = await fetch(`/api/products/${productId}/license-keys`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: data.message,
        })
        fetchLicenseKeys()
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: data.error,
        })
      }
    } catch (error) {
      console.error("Error deleting key:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось удалить ключ",
      })
    } finally {
      setDeletingKeyId(null)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setImageToCrop(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setUploadingCover(true)
    setImageToCrop(null)

    const formDataUpload = new FormData()
    formDataUpload.append("file", croppedBlob, "cover.jpg")
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
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
          aspectRatio={4 / 3}
        />
      )}
      
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

          {/* Additional Images */}
          <Card>
            <CardHeader>
              <CardTitle>Дополнительные изображения</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiImageUpload
                productId={productId}
                initialImages={productImages}
                onImagesChange={setProductImages}
                maxImages={10}
              />
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

          {/* License Keys */}
          {licenseKeyStats.total > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Лицензионные ключи
                  </CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddKeys(!showAddKeys)}
                  >
                    <Plus className="h-4 w-4" />
                    Добавить ключи
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Всего</p>
                    <p className="text-2xl font-bold">{licenseKeyStats.total}</p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Доступно</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {licenseKeyStats.available}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Продано</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {licenseKeyStats.sold}
                    </p>
                  </div>
                </div>

                {/* Add Keys Form */}
                {showAddKeys && (
                  <div className="space-y-3 p-4 border rounded-lg bg-secondary/30">
                    <Label htmlFor="newKeys">
                      Новые ключи (каждый с новой строки)
                    </Label>
                    <Textarea
                      id="newKeys"
                      value={newKeysText}
                      onChange={(e) => setNewKeysText(e.target.value)}
                      placeholder="XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY\nZZZZ-ZZZZ-ZZZZ-ZZZZ"
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <p className="text-sm text-muted-foreground">
                      Ключей для добавления: {newKeysText.split('\n').filter(k => k.trim().length > 0).length}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleAddKeys}
                        disabled={addingKeys}
                        className="flex-1"
                      >
                        {addingKeys ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Добавление...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Добавить
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddKeys(false)
                          setNewKeysText("")
                        }}
                        className="flex-1"
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}

                {/* Keys List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Список ключей</p>
                    <p className="text-xs text-muted-foreground">
                      Показано {licenseKeys.length} из {licenseKeyStats.total}
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {licenseKeys.map((key) => (
                      <div
                        key={key.id}
                        className={`flex items-center justify-between p-3 rounded border ${
                          key.isSold
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        }`}
                      >
                        {/* Key display or edit mode */}
                        {editingKeyId === key.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={editingKeyValue}
                              onChange={(e) => setEditingKeyValue(e.target.value)}
                              className="font-mono text-sm"
                              disabled={updatingKey}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-mono text-sm truncate">
                              {key.key}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Status badge */}
                          {key.isSold ? (
                            <span className="text-xs px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                              Продан
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                              Доступен
                            </span>
                          )}

                          {/* Edit/Save and Delete buttons (only for unsold keys) */}
                          {!key.isSold && (
                            <>
                              {editingKeyId === key.id ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSaveKey(key.id)}
                                    disabled={updatingKey}
                                  >
                                    {updatingKey ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingKeyId(null)
                                      setEditingKeyValue("")
                                    }}
                                    disabled={updatingKey}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditKey(key)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteKey(key.id)}
                                    disabled={deletingKeyId === key.id}
                                  >
                                    {deletingKeyId === key.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
