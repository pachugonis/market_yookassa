import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { authenticator } from "@otplib/preset-default"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { rateLimit } from "@/lib/rate-limit"

const BACKUP_CODE_COUNT = 10

/**
 * Шаг 2 подключения 2FA: проверяем код против секрета, СОХРАНЁННОГО
 * НА СЕРВЕРЕ на шаге /2fa/setup. Ни секрет, ни резервные коды от
 * клиента не принимаются.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const limit = rateLimit(`2fa-enable:${session.user.id}`, 10, 15 * 60 * 1000)
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: "Слишком много попыток. Попробуйте позже." },
        { status: 429 }
      )
    }

    const body = await req.json()
    const token = typeof body?.token === "string" ? body.token.replace(/\s+/g, "") : ""

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    })

    if (!user?.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: "Сначала запросите настройку 2FA" },
        { status: 400 }
      )
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: "Двухфакторная аутентификация уже включена" },
        { status: 400 }
      )
    }

    if (!authenticator.verify({ token, secret: user.twoFactorSecret })) {
      return NextResponse.json(
        { success: false, error: "Invalid verification code" },
        { status: 400 }
      )
    }

    // Резервные коды генерирует сервер и показывает ровно один раз;
    // в базу кладём только хэши.
    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      crypto.randomBytes(5).toString("hex").toUpperCase()
    )

    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 12))
    )

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: hashedBackupCodes,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication enabled successfully",
      data: { backupCodes },
    })
  } catch (error) {
    console.error("2FA enable error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to enable 2FA" },
      { status: 500 }
    )
  }
}
