import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma, ReportStatus, ReportType } from "@prisma/client"

// GET - List all reports with filters (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const type = searchParams.get("type")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    // Значения приходят строкой из адреса, поэтому в фильтр попадают
    // только те, что есть в перечислении: произвольный «?status=...»
    // раньше уходил прямо в запрос и ронял его ошибкой базы.
    const where: Prisma.ReportWhereInput = {}

    if (status && status in ReportStatus) {
      where.status = status as ReportStatus
    }

    if (type && type in ReportType) {
      where.type = type as ReportType
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
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
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report.count({ where }),
    ])

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching reports:", error)
    return NextResponse.json(
      { error: "Ошибка при получении жалоб" },
      { status: 500 }
    )
  }
}
