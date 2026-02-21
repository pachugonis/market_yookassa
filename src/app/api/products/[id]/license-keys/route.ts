import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const addKeysSchema = z.object({
  keys: z.array(z.string().min(1)),
})

// GET: Fetch license keys for a product
export async function GET(
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

    // Check if user owns this product
    const product = await prisma.product.findUnique({
      where: { id },
      select: { sellerId: true, hasLicenseKeys: true },
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

    // Fetch license keys
    const licenseKeys = await prisma.licenseKey.findMany({
      where: { productId: id },
      select: {
        id: true,
        key: true,
        isSold: true,
        soldAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const total = licenseKeys.length
    const available = licenseKeys.filter(k => !k.isSold).length
    const sold = licenseKeys.filter(k => k.isSold).length

    return NextResponse.json({
      success: true,
      data: {
        keys: licenseKeys,
        stats: {
          total,
          available,
          sold,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching license keys:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении ключей" },
      { status: 500 }
    )
  }
}

// POST: Add new license keys
export async function POST(
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

    // Check if user owns this product
    const product = await prisma.product.findUnique({
      where: { id },
      select: { sellerId: true, hasLicenseKeys: true, status: true },
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

    if (!product.hasLicenseKeys) {
      return NextResponse.json(
        { success: false, error: "Этот товар не использует лицензионные ключи" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = addKeysSchema.parse(body)

    // Filter out empty keys and duplicates
    const uniqueKeys = [...new Set(validatedData.keys.filter(k => k.trim().length > 0))]

    if (uniqueKeys.length === 0) {
      return NextResponse.json(
        { success: false, error: "Необходимо добавить хотя бы один ключ" },
        { status: 400 }
      )
    }

    // Check for existing keys
    const existingKeys = await prisma.licenseKey.findMany({
      where: {
        productId: id,
        key: { in: uniqueKeys },
      },
      select: { key: true },
    })

    const existingKeySet = new Set(existingKeys.map(k => k.key))
    const newKeys = uniqueKeys.filter(k => !existingKeySet.has(k))

    if (newKeys.length === 0) {
      return NextResponse.json(
        { success: false, error: "Все указанные ключи уже существуют" },
        { status: 400 }
      )
    }

    // Add new keys
    await prisma.licenseKey.createMany({
      data: newKeys.map(key => ({
        productId: id,
        key,
      })),
    })

    // Check if product was inactive and should be reactivated
    if (product.status === "INACTIVE") {
      await prisma.product.update({
        where: { id },
        data: { status: "ACTIVE" },
      })
      console.log(`Product ${id} reactivated - new license keys added`)
    }

    return NextResponse.json({
      success: true,
      message: `Добавлено ${newKeys.length} ${newKeys.length === 1 ? 'ключ' : 'ключей'}`,
      data: {
        added: newKeys.length,
        skipped: uniqueKeys.length - newKeys.length,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Неверный формат данных" },
        { status: 400 }
      )
    }

    console.error("Error adding license keys:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при добавлении ключей" },
      { status: 500 }
    )
  }
}
