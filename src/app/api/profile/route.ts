import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const profile = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        verified: true,
        balance: true,
        twoFactorEnabled: true,
        createdAt: true,
        _count: {
          select: {
            purchases: true,
            products: true,
          },
        },
      },
    })

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Профиль не найден" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: profile })
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении профиля" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Имя не может быть пустым" },
        { status: 400 }
      )
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { success: false, error: "Имя слишком длинное (максимум 100 символов)" },
        { status: 400 }
      )
    }

    const updatedProfile = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name.trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        verified: true,
        balance: true,
        twoFactorEnabled: true,
        createdAt: true,
        _count: {
          select: {
            purchases: true,
            products: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedProfile })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при обновлении профиля" },
      { status: 500 }
    )
  }
}
