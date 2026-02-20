import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const settingsSchema = z.object({
  commissionRate: z.number().min(0).max(100),
  minPayoutAmount: z.number().min(0).optional(),
  notifyNewUser: z.boolean().optional(),
  notifyNewProduct: z.boolean().optional(),
  notifyNewPurchase: z.boolean().optional(),
  notifyPayoutRequest: z.boolean().optional(),
  notifyReportSubmission: z.boolean().optional(),
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
          commissionRate: 10,
          minPayoutAmount: 100000,
          notifyNewUser: true,
          notifyNewProduct: true,
          notifyNewPurchase: true,
          notifyPayoutRequest: true,
          notifyReportSubmission: false,
        },
      })
    }

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка получения настроек" },
      { status: 500 }
    )
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

    return NextResponse.json({ success: true, data: settings })
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
