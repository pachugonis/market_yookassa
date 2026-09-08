"use client"

import React, { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Search, SlidersHorizontal, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProductCard } from "@/components/products/product-card"

interface Product {
  id: string
  title: string
  price: number
  coverImage: string | null
  downloadCount: number
  seller: { name: string; avatar: string | null }
  category: { name: string; slug: string }
  avgRating?: number
}

interface Category {
  id: string
  name: string
  slug: string
  subcategories?: Category[]
}

export interface CatalogFilterValues {
  search: string
  category: string
  seller: string
}

interface Props {
  initialProducts: Product[]
  initialCategories: Category[]
  /**
   * Фильтры из URL. Приходят пропсами, а не через useSearchParams: этот хук
   * переводит компонент в client-only рендеринг, и карточки исчезли бы из
   * серверного HTML — ровно то, ради чего страница и стала серверной.
   */
  filters: CatalogFilterValues
}

export function ProductsCatalog({ initialProducts, initialCategories, filters }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [categories] = useState<Category[]>(initialCategories)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState(filters.search)
  const [selectedCategory, setSelectedCategory] = useState(filters.category || "all")
  const [sortBy, setSortBy] = useState("newest")
  const [sellerFilter, setSellerFilter] = useState(filters.seller)

  // Первую выдачу уже отрендерил сервер — повторный запрос на монтировании
  // только моргнул бы спиннером поверх готовых карточек.
  const hasRenderedServerData = useRef(true)

  // При переходе по ссылке (например, из меню категорий) сервер присылает
  // новые пропсы, но компонент переиспользуется — состояние синхронизируем.
  const filtersKey = `${filters.search}|${filters.category}|${filters.seller}`
  useEffect(() => {
    setSearchQuery(filters.search)
    setSelectedCategory(filters.category || "all")
    setSellerFilter(filters.seller)
    setProducts(initialProducts)
    hasRenderedServerData.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  useEffect(() => {
    if (hasRenderedServerData.current) {
      hasRenderedServerData.current = false
      return
    }
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, sortBy])

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set("search", searchQuery)
      if (selectedCategory && selectedCategory !== "all") params.set("category", selectedCategory)
      if (sellerFilter) params.set("seller", sellerFilter)
      params.set("sort", sortBy)

      const res = await fetch(`/api/products?${params.toString()}`)
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    hasRenderedServerData.current = false
    fetchProducts()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Каталог товаров</h1>
        <p className="text-muted-foreground">
          Найдите то, что вам нужно среди тысяч цифровых товаров
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col md:flex-row gap-4 mb-8"
      >
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Поиск товаров..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </form>

        <div className="flex gap-3">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {categories.map((cat) => (
                <React.Fragment key={cat.id}>
                  <SelectItem value={cat.slug}>
                    {cat.name}
                  </SelectItem>
                  {cat.subcategories?.map((subcat) => (
                    <SelectItem key={subcat.id} value={subcat.slug} className="pl-8">
                      ↳ {subcat.name}
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Новые</SelectItem>
              <SelectItem value="popular">Популярные</SelectItem>
              <SelectItem value="price_asc">Цена: по возрастанию</SelectItem>
              <SelectItem value="price_desc">Цена: по убыванию</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <p className="text-xl text-muted-foreground mb-4">Товары не найдены</p>
          <Button variant="outline" onClick={() => {
            setSearchQuery("")
            setSelectedCategory("all")
          }}>
            Сбросить фильтры
          </Button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <ProductCard {...product} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
