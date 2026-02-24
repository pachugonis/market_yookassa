import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Токен верификации не предоставлен" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Неверный токен верификации" },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
      return NextResponse.json(
        { success: false, error: "Токен верификации истек" },
        { status: 400 }
      )
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Email успешно подтвержден!",
    })
  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при подтверждении email" },
      { status: 500 }
    )
  }
}
