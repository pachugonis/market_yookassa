"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProductImageCarouselProps {
  images: string[]
  productTitle: string
  className?: string
  showDots?: boolean
}

export function ProductImageCarousel({ 
  images, 
  productTitle, 
  className,
  showDots = true 
}: ProductImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!images || images.length === 0) {
    return (
      <div className={cn("relative aspect-[4/3] bg-secondary overflow-hidden", className)}>
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
          <span className="text-4xl font-bold text-primary/30">
            {productTitle.charAt(0)}
          </span>
        </div>
      </div>
    )
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  return (
    <div className={cn("relative aspect-[4/3] bg-secondary overflow-hidden group", className)}>
      {/* Main Image */}
      <Image
        src={images[currentIndex]}
        alt={`${productTitle} - изображение ${currentIndex + 1}`}
        fill
        className="object-cover transition-opacity duration-300"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />

      {/* Navigation Arrows - show only if more than 1 image */}
      {images.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              goToPrevious()
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              goToNext()
            }}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Dot Navigation - show only if more than 1 image and showDots is true */}
      {images.length > 1 && showDots && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/40 px-2 py-1.5 rounded-full">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                goToSlide(index)
              }}
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                currentIndex === index 
                  ? "bg-white w-6" 
                  : "bg-white/50 hover:bg-white/75"
              )}
              aria-label={`Перейти к изображению ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Image Counter */}
      {images.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  )
}
