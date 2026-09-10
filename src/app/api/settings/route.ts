import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SITE_NAME } from "@/lib/seo"

export async function GET() {
  try {
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
        },
      })
    }

    // Return only public settings
    return NextResponse.json({
      success: true,
      data: {
        siteName: settings.siteName,
        siteDescription: settings.siteDescription,
        supportEmail: settings.supportEmail,
        maxFileSize: settings.maxFileSize,
        // Форме регистрации нужно знать, показывать ли выбор роли.
        // Наружу отдаём следствие, а не сам режим: остальное устройство
        // площадки посетителя не касается.
        sellerRegistrationEnabled: !settings.singleVendorMode,
        // Витрина продавцов: клиентским частям интерфейса нужно знать,
        // рисовать ли ссылку на /stores.
        storesPageEnabled: settings.storesPageEnabled,
      }
    })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка получения настроек" },
      { status: 500 }
    )
  }
}
