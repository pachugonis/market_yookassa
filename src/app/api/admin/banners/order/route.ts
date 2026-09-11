import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const orderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
})

/**
 * Новый порядок карусели целиком — списком id сверху вниз.
 *
 * Весь список, а не «поменять местами два соседних»: так порядок
 * всегда совпадает с тем, что администратор видит на экране, даже если
 * в базе после удалений в нём остались дыры или одинаковые номера.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const { ids } = orderSchema.parse(await request.json())

    if (new Set(ids).size !== ids.length) {
      return NextResponse.json(
        { success: false, error: "Баннер указан в списке дважды" },
        { status: 400 }
      )
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.banner.updateMany({ where: { id }, data: { order: index } })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      )
    }

    console.error("Error reordering banners:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка сохранения порядка" },
      { status: 500 }
    )
  }
}
