import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { rateLimit } from "@/lib/rate-limit"

const BCRYPT_ROUNDS = 12

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    // Ограничиваем перебор текущего пароля при угнанной сессии
    const limit = rateLimit(`change-password:${session.user.id}`, 5, 15 * 60 * 1000)
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: "Слишком много попыток. Попробуйте позже." },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { currentPassword, newPassword } = body

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json(
        { success: false, error: "Все поля обязательны" },
        { status: 400 }
      )
    }

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Все поля обязательны" },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Новый пароль должен содержать минимум 8 символов" },
        { status: 400 }
      )
    }

    // Get current user password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Пользователь не найден" },
        { status: 404 }
      )
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Неверный текущий пароль" },
        { status: 400 }
      )
    }

    // Тот же cost-фактор, что и при регистрации
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

    // Update password
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword }
    })

    return NextResponse.json({
      success: true,
      message: "Пароль успешно изменен"
    })
  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при изменении пароля" },
      { status: 500 }
    )
  }
}
