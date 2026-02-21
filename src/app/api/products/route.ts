import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const createProductSchema = z.object({
  title: z.string().min(3, "Название должно содержать минимум 3 символа"),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов"),
  price: z.number().min(1, "Цена должна быть больше 0"),
  categoryId: z.string(),
  coverImage: z.string().optional(),
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  hasLicenseKeys: z.boolean().optional(),
  licenseKeys: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const seller = searchParams.get("seller")
    const sort = searchParams.get("sort") || "newest"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: Record<string, unknown> = {
      status: "ACTIVE",
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (category && category !== "all") {
      where.category = { slug: category }
    }

    if (seller) {
      where.sellerId = seller
    }

    let orderBy: Record<string, unknown> = { createdAt: "desc" }
    if (sort === "popular") {
      orderBy = { downloadCount: "desc" }
    } else if (sort === "price_asc") {
      orderBy = { price: "asc" }
    } else if (sort === "price_desc") {
      orderBy = { price: "desc" }
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        seller: { select: { name: true, avatar: true } },
        category: { select: { name: true, slug: true } },
        reviews: { select: { rating: true } },
        images: { select: { imageUrl: true, order: true }, orderBy: { order: "asc" } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }) as any

    const productsWithRating = products.map((product: any) => {
      const avgRating =
        product.reviews.length > 0
          ? product.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / product.reviews.length
          : 0
      return {
        id: product.id,
        title: product.title,
        price: product.price,
        coverImage: product.coverImage,
        downloadCount: product.downloadCount,
        seller: product.seller,
        category: product.category,
        avgRating,
        images: product.images.map((img: any) => img.imageUrl),
      }
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

    const body = await request.json()
    const validatedData = createProductSchema.parse(body)

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
