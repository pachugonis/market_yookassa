import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    let settings = await prisma.platformSettings.findFirst()

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
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
        maxFileSize: settings.maxFileSize,
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
