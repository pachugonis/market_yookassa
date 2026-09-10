import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSiteName } from "@/lib/site-settings"
import { authenticator } from "@otplib/preset-default"
import QRCode from "qrcode"

/**
 * Шаг 1 подключения 2FA: сервер генерирует секрет и СРАЗУ сохраняет
 * его в профиль, оставляя twoFactorEnabled = false.
 *
 * Секрет намеренно не принимается обратно от клиента: иначе
 * пользователь (или тот, кто перехватил его сессию) мог бы включить
 * 2FA с заранее известным ему значением.
 */
export async function POST() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, twoFactorEnabled: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    // Пока 2FA включена, перегенерация секрета отключила бы вход
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: "Двухфакторная аутентификация уже включена" },
        { status: 400 }
      )
    }

    const secret = authenticator.generateSecret()

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: false,
        twoFactorBackupCodes: [],
      },
    })

    // Издатель — то, чем площадка подписана в приложении-аутентификаторе.
    // У уже настроенных аккаунтов подпись остаётся прежней: она вшита в
    // добавленную запись и меняется только пересозданием ключа.
    const otpauth = authenticator.keyuri(user.email, await getSiteName(), secret)
    const qrCode = await QRCode.toDataURL(otpauth)

    // Резервные коды выдаются на шаге подтверждения (/2fa/enable),
    // когда пользователь доказал, что приложение настроено.
    return NextResponse.json({
      success: true,
      data: { secret, qrCode },
    })
  } catch (error) {
    console.error("2FA setup error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to setup 2FA" },
      { status: 500 }
    )
  }
}
