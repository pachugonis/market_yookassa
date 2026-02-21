"use client"

import { motion } from "framer-motion"
import { Package, Folder } from "lucide-react"
import { ProductCard } from "@/components/products/product-card"
import Link from "next/link"
import { Card } from "@/components/ui/card"

interface Subcategory {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
  _count: {
    products: number
  }
}

interface Product {
  id: string
  title: string
  price: number
  coverImage: string | null
  downloadCount: number
  seller: { name: string; avatar: string | null }
  category: { name: string; slug: string }
  avgRating: number
}

interface CategoryProductsProps {
  category: {
    name: string
    description: string | null
  }
  products: Product[]
  subcategories: Subcategory[]
}

export function CategoryProducts({ category, products, subcategories }: CategoryProductsProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground">{category.description}</p>
        )}
      </motion.div>

      {subcategories && subcategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {subcategories.map((subcategory) => (
              <Link key={subcategory.id} href={`/category/${subcategory.slug}`}>
                <Card className="p-4 hover:shadow-lg transition-all duration-300 hover:border-primary cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Folder className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                        {subcategory.name}
                      </h3>
                      {subcategory.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {subcategory.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {subcategory._count.products} {subcategory._count.products === 1 ? 'product' : 'products'}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {products.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">
            В этой категории пока нет товаров
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
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
