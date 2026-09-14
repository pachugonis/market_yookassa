import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"
import {
  COVER_IMAGE_PATTERN,
  isValidProductFileUrl,
  resolveUploadPath,
} from "@/lib/storage"
import { unlink } from "fs/promises"
import { isSingleVendorMode } from "@/lib/platform-mode"
import { getPublicProduct } from "@/lib/catalog"

const updateProductSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).max(10000).optional(),
    price: z.number().int().min(1).max(10_000_000).optional(),
    categoryId: z.string().optional(),
    coverImage: z
      .string()
      .regex(COVER_IMAGE_PATTERN, "Недопустимый путь к обложке")
      .optional(),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
    // Замена файла товара. fileUrl приходит от клиента, но подставляется
    // в путь на диске, поэтому принимаем только формат /api/upload.
    fileUrl: z
      .string()
      .refine(isValidProductFileUrl, "Недопустимый путь к файлу")
      .optional(),
    fileName: z.string().min(1).max(255).optional(),
    fileSize: z.number().int().min(0).optional(),
  })
  // Имя и размер описывают именно тот файл, что лежит по fileUrl:
  // порознь они разъехались бы с содержимым.
  .refine(
    (data) =>
      [data.fileUrl, data.fileName, data.fileSize].every(
        (value) => value === undefined
      ) ||
      [data.fileUrl, data.fileName, data.fileSize].every(
        (value) => value !== undefined
      ),
    "Файл товара передаётся вместе с именем и размером"
  )

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()

    // Редактор товара открывает и черновики, и снятые с продажи — ему
    // нужны служебные поля. Путь к файлу (fileUrl) не нужен и ему.
    const owned = session?.user
      ? await prisma.product.findFirst({
          where: {
            id,
            ...(session.user.role === "ADMIN" ? {} : { sellerId: session.user.id }),
          },
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            categoryId: true,
            coverImage: true,
            status: true,
            fileName: true,
            fileSize: true,
            hasLicenseKeys: true,
          },
        })
      : null

    // Всем остальным — то же, что на карточке товара: только видимые
    // товары и без имени и пути к файлу.
    const product = owned ?? (await getPublicProduct(id))

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Товар не найден" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error("Error fetching product:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении товара" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { sellerId: true, fileUrl: true },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Товар не найден" },
        { status: 404 }
      )
    }

    if (product.sellerId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Нет доступа к этому товару" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateProductSchema.parse(body)

    // Новый файл обязан лежать в каталоге того, кто его только что
    // загрузил: иначе можно было бы подставить чужую загрузку, зная путь.
    if (
      validatedData.fileUrl &&
      !validatedData.fileUrl.startsWith(`${session.user.id}/`)
    ) {
      return NextResponse.json(
        { success: false, error: "Недопустимый путь к файлу" },
        { status: 400 }
      )
    }

    // В режиме одного продавца витриной распоряжается администратор.
    // Правку тоже закрываем: иначе в старой карточке можно заменить
    // название, описание и цену — то есть выставить новый товар в обход
    // запрета на создание. Исключение одно — снять свой товар с
    // продажи: это только убирает карточку с витрины, ничего не выставляя.
    if (session.user.role !== "ADMIN" && (await isSingleVendorMode())) {
      const onlyUnpublishes =
        Object.keys(validatedData).length === 1 &&
        validatedData.status === "INACTIVE"

      if (!onlyUnpublishes) {
        return NextResponse.json(
          {
            success: false,
            error: "Товарами на площадке управляет только администратор",
          },
          { status: 403 }
        )
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: validatedData,
      include: {
        seller: { select: { name: true, avatar: true } },
        category: true,
      },
    })

    if (validatedData.fileUrl && validatedData.fileUrl !== product.fileUrl) {
      await removeOrphanedFile(product.fileUrl)
    }

    return NextResponse.json({ success: true, data: updatedProduct })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || "Ошибка валидации" },
        { status: 400 }
      )
    }

    console.error("Error updating product:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при обновлении товара" },
      { status: 500 }
    )
  }
}

/**
 * Удаляет с диска файл заменённого товара: после смены fileUrl он уже
 * никому не отдаётся (скачивание читает путь из карточки товара).
 * Ошибки не роняют запрос — товар уже обновлён.
 */
async function removeOrphanedFile(fileUrl: string) {
  const stillUsed = await prisma.product.count({ where: { fileUrl } })
  if (stillUsed > 0) return

  const filePath = resolveUploadPath(fileUrl)
  if (!filePath) return

  try {
    await unlink(filePath)
  } catch (error) {
    console.error("Не удалось удалить старый файл товара:", error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { sellerId: true },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Товар не найден" },
        { status: 404 }
      )
    }

    if (product.sellerId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Нет доступа к этому товару" },
        { status: 403 }
      )
    }

    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting product:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при удалении товара" },
      { status: 500 }
    )
  }
}
