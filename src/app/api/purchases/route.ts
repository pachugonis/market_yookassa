import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const purchases = await prisma.purchase.findMany({
      where: { buyerId: session.user.id },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            coverImage: true,
            fileName: true,
            fileSize: true,
          },
        },
        licenseKey: {
          select: {
            id: true,
            key: true,
          },
        },
        dispute: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: purchases })
  } catch (error) {
    console.error("Error fetching purchases:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении покупок" },
      { status: 500 }
    )
  }
}
