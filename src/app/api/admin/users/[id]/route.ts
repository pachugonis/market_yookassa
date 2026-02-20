import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const userSchema = z.object({
  name: z.string().min(1, "Имя обязательно"),
  email: z.string().email("Неверный формат email"),
  role: z.enum(["ADMIN", "SELLER", "BUYER"]),
  verified: z.boolean(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = userSchema.parse(body)

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: validatedData.email,
        NOT: { id },
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Email уже используется" },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      )
    }

    console.error("Error updating user:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка обновления пользователя" },
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

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Prevent deleting yourself
    if (session.user.id === id) {
      return NextResponse.json(
        { success: false, error: "Нельзя удалить самого себя" },
        { status: 400 }
      )
    }

    // Check if user has products or purchases
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            purchases: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Пользователь не найден" },
        { status: 404 }
      )
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка удаления пользователя" },
      { status: 500 }
    )
  }
}
