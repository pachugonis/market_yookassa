"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Loader2,
  Package
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatPrice, formatDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Product {
  id: string
  title: string
  price: number
  coverImage: string | null
  status: string
  downloadCount: number
  createdAt: string
  category: { name: string }
  _count: { purchases: number; reviews: number }
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/seller/products")
      const data = await res.json()
      if (data.success) {
        setProducts(data.data)
      }
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/products/${deleteId}`, { method: "DELETE" })
      const data = await res.json()

      if (data.success) {
        setProducts(products.filter((p) => p.id !== deleteId))
        toast({ title: "Товар удален" })
      } else {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось удалить товар", variant: "destructive" })
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Мои товары</h1>
          <p className="text-muted-foreground">Управление вашими цифровыми товарами</p>
        </div>
        <Link href="/dashboard/products/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Добавить товар
          </Button>
        </Link>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Нет товаров</h3>
            <p className="text-muted-foreground mb-4">
              Создайте свой первый товар для продажи
            </p>
            <Link href="/dashboard/products/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Добавить товар
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-secondary shrink-0">
                      {product.coverImage ? (
                        <Image
                          src={product.coverImage}
                          alt={product.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10">
                          <span className="text-2xl font-bold text-primary/30">
                            {product.title.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold truncate">{product.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {product.category.name} • {formatDate(new Date(product.createdAt))}
                          </p>
                        </div>
                        <Badge
                          variant={
                            product.status === "ACTIVE" ? "success" :
                            product.status === "DRAFT" ? "secondary" : "destructive"
                          }
                        >
                          {product.status === "ACTIVE" ? "Активен" :
                           product.status === "DRAFT" ? "Черновик" : "Неактивен"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {formatPrice(product.price)}
                        </span>
                        <span>{product._count.purchases} продаж</span>
                        <span>{product.downloadCount} скачиваний</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <Link href={`/products/${product.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/dashboard/products/${product.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(product.id)}
                          className="text-red-600 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить товар?</DialogTitle>
            <DialogDescription>
              Это действие нельзя отменить. Товар будет удален безвозвратно.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
