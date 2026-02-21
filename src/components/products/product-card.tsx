"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Star, Download } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatPrice } from "@/lib/utils"
import { ProductImageCarousel } from "@/components/ui/product-image-carousel"

interface ProductCardProps {
  id: string
  title: string
  price: number
  coverImage: string | null
  seller: {
    name: string
    avatar: string | null
  }
  category: {
    name: string
    slug: string
  }
  downloadCount?: number
  avgRating?: number
  images?: string[]
}

export function ProductCard({
  id,
  title,
  price,
  coverImage,
  seller,
  category,
  downloadCount = 0,
  avgRating,
  images = [],
}: ProductCardProps) {
  // Combine coverImage with additional images
  const displayImages = (() => {
    const allImages: string[] = []
    
    // Add cover image first if it exists
    if (coverImage) {
      allImages.push(coverImage)
    }
    
    // Add additional images
    if (images.length > 0) {
      allImages.push(...images)
    }
    
    return allImages
  })()
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/products/${id}`}>
        <Card className="overflow-hidden group cursor-pointer card-hover border-0 shadow-md hover:shadow-xl">
          <ProductImageCarousel
            images={displayImages}
            productTitle={title}
            className="rounded-t-lg"
          />
          <Badge className="absolute top-3 left-3 z-10" variant="secondary">
            {category.name}
          </Badge>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
              {title}
            </h3>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={seller.avatar || ""} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {seller.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground truncate max-w-[100px]">
                  {seller.name}
                </span>
              </div>
              
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {avgRating !== undefined && avgRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{avgRating.toFixed(1)}</span>
                  </div>
                )}
                {downloadCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Download className="h-4 w-4" />
                    <span>{downloadCount}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <span className="text-xl font-bold text-primary">
                {formatPrice(price)}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
