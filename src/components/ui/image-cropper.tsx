"use client"

import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"
import { Area, Point } from "react-easy-crop"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ZoomIn, ZoomOut } from "lucide-react"

interface ImageCropperProps {
  image: string
  onCropComplete: (croppedImageBlob: Blob) => void
  onCancel: () => void
  aspectRatio?: number
}

export function ImageCropper({ image, onCropComplete, onCancel, aspectRatio = 4 / 3 }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const onCropChange = (location: Point) => {
    setCrop(location)
  }

  const onZoomChange = (zoom: number) => {
    setZoom(zoom)
  }

  const onCropAreaChange = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createCroppedImage = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!croppedAreaPixels) {
        reject(new Error("No crop area"))
        return
      }

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      
      if (!ctx) {
        reject(new Error("Failed to get canvas context"))
        return
      }

      const imageElement = new Image()
      imageElement.src = image
      
      imageElement.onload = () => {
        const { width, height, x, y } = croppedAreaPixels

        canvas.width = width
        canvas.height = height

        ctx.drawImage(
          imageElement,
          x,
          y,
          width,
          height,
          0,
          0,
          width,
          height
        )

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error("Failed to create blob"))
          }
        }, "image/jpeg", 0.95)
      }

      imageElement.onerror = () => {
        reject(new Error("Failed to load image"))
      }
    })
  }

  const handleCropConfirm = async () => {
    setIsProcessing(true)
    try {
      const croppedBlob = await createCroppedImage()
      onCropComplete(croppedBlob)
    } catch (error) {
      console.error("Error cropping image:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => !isProcessing && onCancel()}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Обрезать изображение</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Cropper Area */}
          <div className="relative h-[400px] bg-black rounded-lg overflow-hidden">
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropAreaChange}
            />
          </div>

          {/* Zoom Control */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ZoomOut className="h-4 w-4" />
              Масштаб
              <ZoomIn className="h-4 w-4" />
            </Label>
            <Slider
              value={[zoom]}
              onValueChange={(values: number[]) => setZoom(values[0])}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* Info */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Перетащите изображение для позиционирования</p>
            <p>• Используйте ползунок для изменения масштаба</p>
            <p>• Соотношение сторон: {aspectRatio === 4/3 ? "4:3" : aspectRatio === 16/9 ? "16:9" : aspectRatio === 1 ? "1:1" : "произвольное"}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Отмена
          </Button>
          <Button onClick={handleCropConfirm} disabled={isProcessing}>
            {isProcessing ? "Обработка..." : "Применить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
