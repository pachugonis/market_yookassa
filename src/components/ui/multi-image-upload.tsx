"use client"

import { useState } from "react"
import { X, Upload, Loader2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { ImageCropper } from "@/components/ui/image-cropper"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface MultiImageUploadProps {
  productId?: string
  initialImages?: Array<{ id: string; imageUrl: string; order: number }>
  onImagesChange?: (images: Array<{ id: string; imageUrl: string; order: number }>) => void
  maxImages?: number
}

export function MultiImageUpload({ 
  productId, 
  initialImages = [], 
  onImagesChange,
  maxImages = 10 
}: MultiImageUploadProps) {
  const [images, setImages] = useState(initialImages)
  const [uploading, setUploading] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (images.length >= maxImages) {
      toast({
        title: "Лимит достигнут",
        description: `Максимум ${maxImages} изображений`,
        variant: "destructive"
      })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImageToCrop(reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setUploading(true)
    setImageToCrop(null)

    const formData = new FormData()
    formData.append("file", croppedBlob, "image.jpg")
    formData.append("type", "cover")

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (data.success) {
        const imageUrl = data.data.fileUrl

        if (productId) {
          // If we have a productId, save to database
          const saveRes = await fetch(`/api/products/${productId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl }),
          })

          const saveData = await saveRes.json()

          if (saveData.success) {
            const newImages = [...images, saveData.data]
            setImages(newImages)
            onImagesChange?.(newImages)
            toast({ title: "Изображение добавлено" })
          } else {
            toast({ title: "Ошибка", description: saveData.error, variant: "destructive" })
          }
        } else {
          // For new products, just store locally
          const newImage = {
            id: `temp-${Date.now()}`,
            imageUrl,
            order: images.length
          }
          const newImages = [...images, newImage]
          setImages(newImages)
          onImagesChange?.(newImages)
          toast({ title: "Изображение добавлено" })
        }
      } else {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Ошибка загрузки", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (index: number) => {
    const image = images[index]

    if (productId && !image.id.startsWith("temp-")) {
      // Delete from database
      try {
        const res = await fetch(`/api/products/${productId}/images?imageId=${image.id}`, {
          method: "DELETE",
        })

        const data = await res.json()

        if (data.success) {
          const newImages = images.filter((_, i) => i !== index)
          setImages(newImages)
          onImagesChange?.(newImages)
          toast({ title: "Изображение удалено" })
        } else {
          toast({ title: "Ошибка", description: data.error, variant: "destructive" })
        }
      } catch (error) {
        toast({ title: "Ошибка удаления", variant: "destructive" })
      }
    } else {
      // Just remove from local state
      const newImages = images.filter((_, i) => i !== index)
      setImages(newImages)
      onImagesChange?.(newImages)
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newImages = [...images]
    const draggedImage = newImages[draggedIndex]
    newImages.splice(draggedIndex, 1)
    newImages.splice(index, 0, draggedImage)

    setImages(newImages)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    // Update order in state
    const reorderedImages = images.map((img, idx) => ({ ...img, order: idx }))
    setImages(reorderedImages)
    onImagesChange?.(reorderedImages)
  }

  return (
    <>
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
          aspectRatio={4 / 3}
        />
      )}

      <div className="space-y-4">
        {/* Image Grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((image, index) => (
              <div
                key={image.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "relative aspect-[4/3] rounded-lg overflow-hidden bg-secondary cursor-move group",
                  draggedIndex === index && "opacity-50"
                )}
              >
                <Image
                  src={image.imageUrl}
                  alt={`Изображение ${index + 1}`}
                  fill
                  className="object-cover"
                />
                
                {/* Order Badge */}
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded">
                  {index + 1}
                </div>

                {/* Drag Handle */}
                <div className="absolute top-2 right-10 bg-black/70 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="h-4 w-4" />
                </div>

                {/* Delete Button */}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Upload Button */}
        {images.length < maxImages && (
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Добавить изображение ({images.length}/{maxImages})
                </span>
              </>
            )}
          </label>
        )}

        <p className="text-xs text-muted-foreground">
          • Перетащите изображения для изменения порядка
          <br />
          • Первое изображение будет использоваться как обложка
          <br />
          • Максимум {maxImages} изображений
        </p>
      </div>
    </>
  )
}
