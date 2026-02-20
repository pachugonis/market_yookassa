import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateReportSchema = z.object({
  status: z.enum(["PENDING", "UNDER_REVIEW", "RESOLVED", "REJECTED", "CLOSED"]).optional(),
  adminNote: z.string().optional(),
})

// GET - Get report by ID (admin only)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const { id } = await params

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    if (!report) {
      return NextResponse.json(
        { error: "Жалоба не найдена" },
        { status: 404 }
      )
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error("Error fetching report:", error)
    return NextResponse.json(
      { error: "Ошибка при получении жалобы" },
      { status: 500 }
    )
  }
}

// PATCH - Update report status/note (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()
    const validatedData = updateReportSchema.parse(body)

    const updateData: any = {
      ...validatedData,
      updatedAt: new Date(),
    }

    // If status is being changed to RESOLVED or CLOSED, set resolvedAt
    if (validatedData.status === "RESOLVED" || validatedData.status === "CLOSED") {
      updateData.resolvedAt = new Date()
    }

    const report = await prisma.report.update({
      where: { id },
      data: updateData,
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    return NextResponse.json({
      message: "Жалоба обновлена",
      report,
    })
  } catch (error) {
    console.error("Error updating report:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Неверные данные", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Ошибка при обновлении жалобы" },
      { status: 500 }
    )
  }
}

// DELETE - Delete report (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const { id } = await params

    await prisma.report.delete({
      where: { id },
    })

    return NextResponse.json({
      message: "Жалоба удалена",
    })
  } catch (error) {
    console.error("Error deleting report:", error)
    return NextResponse.json(
      { error: "Ошибка при удалении жалобы" },
      { status: 500 }
    )
  }
}
