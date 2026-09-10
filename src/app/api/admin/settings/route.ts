import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { SITE_NAME } from "@/lib/seo"
import { z } from "zod"

const settingsSchema = z.object({
  siteName: z.string().min(1).max(100).optional(),
  siteDescription: z.string().min(1).max(500).optional(),
  supportEmail: z.string().email().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  minPayoutAmount: z.number().min(0).optional(),
  // Вывод биткоина: порог и рамки, в которых зажимается оценка сети.
  btcMinPayoutSats: z.number().int().min(546).optional(),
  btcPayoutFeeMinSats: z.number().int().min(0).optional(),
  btcPayoutFeeMaxSats: z.number().int().min(0).optional(),
  btcPayoutFeeBlockTarget: z.number().int().min(1).max(144).optional(),
  btcPayoutTxVsize: z.number().int().min(100).max(2000).optional(),
  btcPayoutQuoteMinutes: z.number().int().min(1).max(120).optional(),
  maxFileSize: z.number().min(1).max(5000).optional(),
  notifyNewUser: z.boolean().optional(),
  notifyNewProduct: z.boolean().optional(),
  notifyNewPurchase: z.boolean().optional(),
  notifyPayoutRequest: z.boolean().optional(),
  notifyReportSubmission: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  enableTwoFactor: z.boolean().optional(),
  sessionTimeout: z.number().min(1).max(168).optional(),
  maxLoginAttempts: z.number().min(3).max(10).optional(),
  singleVendorMode: z.boolean().optional(),
  storesPageEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().min(1).max(500).optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().min(1).max(100).optional(),
})

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    let settings = await prisma.platformSettings.findFirst()

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          siteName: SITE_NAME,
          siteDescription: "Маркетплейс цифровых товаров",
          supportEmail: "support@amazonus.ru",
          commissionRate: 10,
          minPayoutAmount: 100000,
          maxFileSize: 500,
          notifyNewUser: true,
          notifyNewProduct: true,
          notifyNewPurchase: true,
          notifyPayoutRequest: true,
          notifyReportSubmission: false,
          requireEmailVerification: false,
          enableTwoFactor: false,
          sessionTimeout: 24,
          maxLoginAttempts: 5,
          singleVendorMode: false,
          storesPageEnabled: true,
          maintenanceMode: false,
          maintenanceMessage: "Сайт временно недоступен. Ведутся технические работы.",
        },
      })
    }

    return NextResponse.json({ success: true, data: redactSecrets(settings) })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка получения настроек" },
      { status: 500 }
    )
  }
}

/**
 * Пароль SMTP наружу не отдаём даже администратору: он не нужен
 * интерфейсу и не должен попадать в историю браузера, логи и devtools.
 * Клиент присылает его только когда действительно меняет.
 */
function redactSecrets<T extends { smtpPassword: string | null }>(settings: T) {
  return {
    ...settings,
    smtpPassword: undefined,
    smtpPasswordSet: Boolean(settings.smtpPassword),
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = settingsSchema.parse(body)

    // Пустая строка означает «не менять», а не «стереть пароль»:
    // форма получает его замаскированным и присылает пустым.
    if (validatedData.smtpPassword === "") {
      delete validatedData.smtpPassword
    }

    let settings = await prisma.platformSettings.findFirst()

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: validatedData,
      })
    } else {
      settings = await prisma.platformSettings.update({
        where: { id: settings.id },
        data: validatedData,
      })
    }

    return NextResponse.json({ success: true, data: redactSecrets(settings) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      )
    }

    console.error("Error updating settings:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка обновления настроек" },
      { status: 500 }
    )
  }
}
