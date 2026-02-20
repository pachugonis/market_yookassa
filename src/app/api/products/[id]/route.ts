import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const updateProductSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  price: z.number().min(1).optional(),
  categoryId: z.string().optional(),
  coverImage: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, avatar: true } },
        category: true,
        reviews: {
          include: {
            buyer: { select: { name: true, avatar: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { reviews: true, purchases: true } },
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Товар не найден" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error("Error fetching product:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении товара" },
      { status: 500 }
    )
  }
}

export async function PUT(
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
        { success: false, error: "Нет доступа к этому товару" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateProductSchema.parse(body)

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: validatedData,
      include: {
        seller: { select: { name: true, avatar: true } },
        category: true,
      },
    })

    return NextResponse.json({ success: true, data: updatedProduct })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || "Ошибка валидации" },
        { status: 400 }
      )
    }

    console.error("Error updating product:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при обновлении товара" },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
        { success: false, error: "Нет доступа к этому товару" },
        { status: 403 }
      )
    }

    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting product:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при удалении товара" },
      { status: 500 }
    )
  }
}
