import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: {
        parentId: null, // Only get top-level categories
      },
      orderBy: { name: "asc" },
      include: {
        subcategories: {
          orderBy: { name: "asc" },
        },
      },
    })

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении категорий" },
      { status: 500 }
    )
  }
}
