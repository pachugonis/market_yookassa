import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const addKeysSchema = z.object({
  keys: z.array(z.string().min(1)),
})

const updateKeySchema = z.object({
  keyId: z.string(),
  newKey: z.string().min(1),
})

const deleteKeySchema = z.object({
  keyId: z.string(),
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

// PATCH: Update a license key
export async function PATCH(
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

    const body = await request.json()
    const validatedData = updateKeySchema.parse(body)

    // Check if key exists and belongs to this product
    const existingKey = await prisma.licenseKey.findUnique({
      where: { id: validatedData.keyId },
    })

    if (!existingKey || existingKey.productId !== id) {
      return NextResponse.json(
        { success: false, error: "Ключ не найден" },
        { status: 404 }
      )
    }

    if (existingKey.isSold) {
      return NextResponse.json(
        { success: false, error: "Нельзя редактировать проданный ключ" },
        { status: 400 }
      )
    }

    // Check if new key already exists
    const duplicateKey = await prisma.licenseKey.findFirst({
      where: {
        productId: id,
        key: validatedData.newKey,
        id: { not: validatedData.keyId },
      },
    })

    if (duplicateKey) {
      return NextResponse.json(
        { success: false, error: "Такой ключ уже существует" },
        { status: 400 }
      )
    }

    // Update the key
    await prisma.licenseKey.update({
      where: { id: validatedData.keyId },
      data: { key: validatedData.newKey },
    })

    return NextResponse.json({
      success: true,
      message: "Ключ обновлен",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Неверный формат данных" },
        { status: 400 }
      )
    }

    console.error("Error updating license key:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при обновлении ключа" },
      { status: 500 }
    )
  }
}

// DELETE: Delete a license key
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

    const body = await request.json()
    const validatedData = deleteKeySchema.parse(body)

    // Check if key exists and belongs to this product
    const existingKey = await prisma.licenseKey.findUnique({
      where: { id: validatedData.keyId },
    })

    if (!existingKey || existingKey.productId !== id) {
      return NextResponse.json(
        { success: false, error: "Ключ не найден" },
        { status: 404 }
      )
    }

    if (existingKey.isSold) {
      return NextResponse.json(
        { success: false, error: "Нельзя удалить проданный ключ" },
        { status: 400 }
      )
    }

    // Delete the key
    await prisma.licenseKey.delete({
      where: { id: validatedData.keyId },
    })

    return NextResponse.json({
      success: true,
      message: "Ключ удален",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Неверный формат данных" },
        { status: 400 }
      )
    }

    console.error("Error deleting license key:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при удалении ключа" },
      { status: 500 }
    )
  }
}
