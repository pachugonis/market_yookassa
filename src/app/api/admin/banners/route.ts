import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { bannerSchema } from "@/lib/banners"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const data = bannerSchema.parse(await request.json())

    // Новый баннер встаёт в конец карусели: порядок уже настроенных
    // от добавления меняться не должен.
    const last = await prisma.banner.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const banner = await prisma.banner.create({
      data: { ...data, order: (last?.order ?? -1) + 1 },
    })

    return NextResponse.json({ success: true, data: banner }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      )
    }

    console.error("Error creating banner:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка создания баннера" },
      { status: 500 }
    )
  }
}
