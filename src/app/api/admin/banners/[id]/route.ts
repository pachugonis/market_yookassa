import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { bannerSchema, removeBannerImage } from "@/lib/banners"

const updateBannerSchema = bannerSchema.partial()

async function requireAdmin() {
  const session = await auth()
  return session?.user?.role === "ADMIN"
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const { id } = await params
    const data = updateBannerSchema.parse(await request.json())

    const existing = await prisma.banner.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Баннер не найден" },
        { status: 404 }
      )
    }

    const banner = await prisma.banner.update({ where: { id }, data })

    // Заменённые картинки больше ни на что не ссылаются: каждая
    // загрузка получает новое имя, общих файлов у баннеров нет.
    if (data.imageUrl !== undefined && data.imageUrl !== existing.imageUrl) {
      await removeBannerImage(existing.imageUrl)
    }
    if (
      data.mobileImageUrl !== undefined &&
      data.mobileImageUrl !== existing.mobileImageUrl
    ) {
      await removeBannerImage(existing.mobileImageUrl)
    }

    return NextResponse.json({ success: true, data: banner })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      )
    }

    console.error("Error updating banner:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка обновления баннера" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const { id } = await params
    const existing = await prisma.banner.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Баннер не найден" },
        { status: 404 }
      )
    }

    await prisma.banner.delete({ where: { id } })
    await removeBannerImage(existing.imageUrl)
    await removeBannerImage(existing.mobileImageUrl)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting banner:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка удаления баннера" },
      { status: 500 }
    )
  }
}
