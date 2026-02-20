import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createReportSchema = z.object({
  type: z.enum(["PRODUCT", "USER", "REVIEW", "OTHER"]),
  reason: z.enum(["SPAM", "INAPPROPRIATE_CONTENT", "FRAUD", "COPYRIGHT", "HARASSMENT", "MISLEADING", "OTHER"]),
  description: z.string().min(10).max(1000),
  reportedUserId: z.string().optional(),
  reportedProductId: z.string().optional(),
  reportedReviewId: z.string().optional(),
})

// POST - Create a new report
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Необходимо войти в систему" },
        { status: 401 }
      )
    }

    const body = await req.json()
    const validatedData = createReportSchema.parse(body)

    // Validate that at least one reported entity is provided
    if (!validatedData.reportedUserId && !validatedData.reportedProductId && !validatedData.reportedReviewId) {
      return NextResponse.json(
        { error: "Необходимо указать объект жалобы" },
        { status: 400 }
      )
    }

    // Create the report
    const report = await prisma.report.create({
      data: {
        type: validatedData.type,
        reason: validatedData.reason,
        description: validatedData.description,
        reporterId: session.user.id,
        reportedUserId: validatedData.reportedUserId,
        reportedProductId: validatedData.reportedProductId,
        reportedReviewId: validatedData.reportedReviewId,
      },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      message: "Жалоба успешно отправлена",
      report,
    })
  } catch (error) {
    console.error("Error creating report:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Неверные данные", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Ошибка при создании жалобы" },
      { status: 500 }
    )
  }
}

// GET - Get user's reports
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Необходимо войти в систему" },
        { status: 401 }
      )
    }

    const reports = await prisma.report.findMany({
      where: {
        reporterId: session.user.id,
      },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ reports })
  } catch (error) {
    console.error("Error fetching reports:", error)
    return NextResponse.json(
      { error: "Ошибка при получении жалоб" },
      { status: 500 }
    )
  }
}
