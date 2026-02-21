import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Get product images
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const images = await prisma.productImage.findMany({
      where: { productId: id },
      orderBy: { order: "asc" },
    })

    return NextResponse.json({ success: true, data: images })
  } catch (error) {
    console.error("Error fetching product images:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении изображений" },
      { status: 500 }
    )
  }
}

// Add images to product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    // Verify product ownership
    const product = await prisma.product.findUnique({
      where: { id },
      select: { sellerId: true },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Товар не найден" },
        { status: 404 }
      )
    }

    if (product.sellerId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { imageUrl } = body

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "URL изображения не предоставлен" },
        { status: 400 }
      )
    }

    // Check current image count
    const imageCount = await prisma.productImage.count({
      where: { productId: id },
    })

    if (imageCount >= 10) {
      return NextResponse.json(
        { success: false, error: "Максимум 10 изображений на товар" },
        { status: 400 }
      )
    }

    // Create new image with order
    const image = await prisma.productImage.create({
      data: {
        productId: id,
        imageUrl,
        order: imageCount,
      },
    })

    return NextResponse.json({ success: true, data: image }, { status: 201 })
  } catch (error) {
    console.error("Error adding product image:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при добавлении изображения" },
      { status: 500 }
    )
  }
}

// Delete image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get("imageId")

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: "ID изображения не предоставлен" },
        { status: 400 }
      )
    }

    // Verify product ownership
    const product = await prisma.product.findUnique({
      where: { id },
      select: { sellerId: true },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Товар не найден" },
        { status: 404 }
      )
    }

    if (product.sellerId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    // Delete image
    await prisma.productImage.delete({
      where: { id: imageId },
    })

    // Reorder remaining images
    const remainingImages = await prisma.productImage.findMany({
      where: { productId: id },
      orderBy: { order: "asc" },
    })

    for (let i = 0; i < remainingImages.length; i++) {
      await prisma.productImage.update({
        where: { id: remainingImages[i].id },
        data: { order: i },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting product image:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при удалении изображения" },
      { status: 500 }
    )
  }
}
