import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET - List seller's disputes
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    console.log("[GET /api/disputes/seller] Fetching disputes for seller:", session.user.id)

    // Get disputes for products sold by this seller
    const disputes = await prisma.dispute.findMany({
      where: {
        purchase: {
          product: {
            sellerId: session.user.id,
          },
        },
      },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        purchase: {
          select: {
            id: true,
            amount: true,
            sellerEarnings: true,
            product: {
              select: {
                id: true,
                title: true,
                coverImage: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    })

    console.log("[GET /api/disputes/seller] Found disputes:", disputes.length)

    return NextResponse.json({ success: true, data: disputes })
  } catch (error) {
    console.error("[GET /api/disputes/seller] Error:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при загрузке споров" },
      { status: 500 }
    )
  }
}
