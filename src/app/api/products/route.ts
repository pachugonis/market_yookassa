import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"
import { isValidProductFileUrl, COVER_IMAGE_PATTERN } from "@/lib/storage"
import { getCatalogProducts } from "@/lib/catalog"
import { isSingleVendorMode } from "@/lib/platform-mode"

const createProductSchema = z.object({
  title: z.string().min(3, "Название должно содержать минимум 3 символа").max(200),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов").max(10000),
  price: z.number().int().min(1, "Цена должна быть больше 0").max(10_000_000),
  categoryId: z.string(),
  coverImage: z
    .string()
    .regex(COVER_IMAGE_PATTERN, "Недопустимый путь к обложке")
    .optional(),
  // fileUrl приходит от клиента, но подставляется в путь на диске,
  // поэтому принимаем только формат, который выдаёт /api/upload.
  fileUrl: z
    .string()
    .refine(isValidProductFileUrl, "Недопустимый путь к файлу"),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().min(0),
  hasLicenseKeys: z.boolean().optional(),
  licenseKeys: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const productsWithRating = await getCatalogProducts({
      search: searchParams.get("search"),
      category: searchParams.get("category"),
      seller: searchParams.get("seller"),
      sort: searchParams.get("sort"),
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
    })

    return NextResponse.json({ success: true, data: productsWithRating })
  } catch (error) {
    console.error("Error fetching products:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении товаров" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Только продавцы могут создавать товары" },
        { status: 403 }
      )
    }

    // В режиме одного продавца витрину наполняет только администратор:
    // роль SELLER могла остаться у аккаунтов, заведённых до включения
    // режима, и сама по себе права выставлять товар больше не даёт.
    if (session.user.role !== "ADMIN" && (await isSingleVendorMode())) {
      return NextResponse.json(
        {
          success: false,
          error: "Товары на площадке выставляет только администратор",
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createProductSchema.parse(body)

    // Файл обязан лежать в каталоге самого продавца: иначе можно было
    // бы сослаться на чужую загрузку, зная её путь.
    if (!validatedData.fileUrl.startsWith(`${session.user.id}/`)) {
      return NextResponse.json(
        { success: false, error: "Недопустимый путь к файлу" },
        { status: 400 }
      )
    }

    const { licenseKeys, hasLicenseKeys, ...productData } = validatedData

    const product = await prisma.product.create({
      data: {
        ...productData,
        sellerId: session.user.id,
        status: "ACTIVE",
        hasLicenseKeys: hasLicenseKeys || false,
        ...(hasLicenseKeys && licenseKeys && licenseKeys.length > 0 ? {
          licenseKeys: {
            create: licenseKeys.map((key) => ({ key }))
          }
        } : {})
      },
      include: {
        seller: { select: { name: true, avatar: true } },
        category: { select: { name: true, slug: true } },
        licenseKeys: { select: { id: true, key: true, isSold: true } }
      },
    })

    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || "Ошибка валидации" },
        { status: 400 }
      )
    }

    console.error("Error creating product:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при создании товара" },
      { status: 500 }
    )
  }
}
