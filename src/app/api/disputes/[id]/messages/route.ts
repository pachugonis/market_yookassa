import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET - Get messages for a dispute
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    // Handle both Promise and direct params for Next.js compatibility
    const params = context.params instanceof Promise ? await context.params : context.params
    const disputeId = params.id

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        purchase: {
          include: {
            product: {
              select: {
                sellerId: true,
              },
            },
          },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Спор не найден" },
        { status: 404 }
      )
    }

    // Check if user is buyer or seller
    const isBuyer = dispute.buyerId === session.user.id
    const isSeller = dispute.purchase.product.sellerId === session.user.id

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const messages = await prisma.disputeMessage.findMany({
      where: { disputeId: disputeId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ success: true, data: messages })
  } catch (error) {
    console.error("Error fetching dispute messages:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при загрузке сообщений" },
      { status: 500 }
    )
  }
}

// POST - Send a message in dispute
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    // Handle both Promise and direct params for Next.js compatibility
    const params = context.params instanceof Promise ? await context.params : context.params
    const disputeId = params.id
    
    console.log("[POST /api/disputes/[id]/messages] Dispute ID:", disputeId)
    console.log("[POST /api/disputes/[id]/messages] User ID:", session.user.id)

    const { message } = await request.json()
    console.log("[POST /api/disputes/[id]/messages] Message:", message)

    if (!message || message.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Сообщение не может быть пустым" },
        { status: 400 }
      )
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        purchase: {
          include: {
            product: {
              select: {
                sellerId: true,
              },
            },
          },
        },
      },
    })

    console.log("[POST /api/disputes/[id]/messages] Dispute found:", !!dispute)

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Спор не найден" },
        { status: 404 }
      )
    }

    // Check if dispute is still open
    if (dispute.status !== "OPEN") {
      return NextResponse.json(
        { success: false, error: "Спор закрыт, сообщения невозможны" },
        { status: 400 }
      )
    }

    // Check if user is buyer or seller
    const isBuyer = dispute.buyerId === session.user.id
    const isSeller = dispute.purchase.product.sellerId === session.user.id

    console.log("[POST /api/disputes/[id]/messages] isBuyer:", isBuyer, "isSeller:", isSeller)

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const newMessage = await prisma.disputeMessage.create({
      data: {
        disputeId: disputeId,
        senderId: session.user.id,
        message: message.trim(),
        isFromBuyer: isBuyer,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    console.log("[POST /api/disputes/[id]/messages] Message created:", newMessage.id)

    // TODO: Send notification to the other party

    return NextResponse.json({
      success: true,
      data: newMessage,
      message: "Сообщение отправлено",
    })
  } catch (error) {
    console.error("[POST /api/disputes/[id]/messages] Error:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при отправке сообщения" },
      { status: 500 }
    )
  }
}
