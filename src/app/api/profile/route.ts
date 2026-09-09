import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isValidBitcoinAddress } from "@/lib/btcpay"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const profile = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        verified: true,
        balance: true,
        balanceSats: true,
        btcPayoutAddress: true,
        btcPayoutAddressSetAt: true,
        yookassaAccountId: true,
        // Токен карты наружу не отдаём — только то, что нужно показать.
        cloudpaymentsPayoutCard: true,
        cloudpaymentsPayoutBoundAt: true,
        twoFactorEnabled: true,
        createdAt: true,
        _count: {
          select: {
            purchases: true,
            products: true,
          },
        },
      },
    })

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Профиль не найден" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: profile })
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении профиля" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Необходима авторизация" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, avatar, yookassaAccountId, btcPayoutAddress } = body

    // Prepare update data
    const updateData: {
      name?: string
      avatar?: string
      yookassaAccountId?: string | null
      btcPayoutAddress?: string | null
      btcPayoutAddressSetAt?: Date | null
    } = {}

    // Validate and add name if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Имя не может быть пустым" },
          { status: 400 }
        )
      }

      if (name.trim().length > 100) {
        return NextResponse.json(
          { success: false, error: "Имя слишком длинное (максимум 100 символов)" },
          { status: 400 }
        )
      }

      updateData.name = name.trim()
    }

    // Validate and add avatar if provided
    if (avatar !== undefined) {
      if (typeof avatar !== "string") {
        return NextResponse.json(
          { success: false, error: "Неверный формат аватара" },
          { status: 400 }
        )
      }
      updateData.avatar = avatar
    }

    // Реквизиты продавца у платёжных сервисов: на них уходит выручка
    // при сплитовании. Пустая строка отключает сплит — тогда деньги
    // приходят площадке и распределяются через внутренний баланс.
    if (yookassaAccountId !== undefined) {
      if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
        return NextResponse.json(
          { success: false, error: "Счёт для выплат доступен только продавцам" },
          { status: 403 }
        )
      }

      if (typeof yookassaAccountId !== "string") {
        return NextResponse.json(
          { success: false, error: "Неверный формат идентификатора счёта" },
          { status: 400 }
        )
      }

      const account = yookassaAccountId.trim()

      if (account.length === 0) {
        updateData.yookassaAccountId = null
      } else if (!/^\d{3,40}$/.test(account)) {
        return NextResponse.json(
          {
            success: false,
            error: "Идентификатор счёта ЮKassa состоит только из цифр",
          },
          { status: 400 }
        )
      } else {
        updateData.yookassaAccountId = account
      }
    }

    // Кошелёк для вывода биткоина. Проверяем формат сами: заявка с
    // опечаткой в адресе отправила бы деньги в никуда.
    if (btcPayoutAddress !== undefined) {
      if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
        return NextResponse.json(
          { success: false, error: "Кошелёк для выплат доступен только продавцам" },
          { status: 403 }
        )
      }

      if (typeof btcPayoutAddress !== "string") {
        return NextResponse.json(
          { success: false, error: "Неверный формат адреса" },
          { status: 400 }
        )
      }

      const address = btcPayoutAddress.trim()

      if (address.length === 0) {
        updateData.btcPayoutAddress = null
        updateData.btcPayoutAddressSetAt = null
      } else if (!isValidBitcoinAddress(address)) {
        return NextResponse.json(
          { success: false, error: "Это не похоже на биткоин-адрес" },
          { status: 400 }
        )
      } else {
        updateData.btcPayoutAddress = address
        updateData.btcPayoutAddressSetAt = new Date()
      }
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "Нет данных для обновления" },
        { status: 400 }
      )
    }

    const updatedProfile = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        verified: true,
        balance: true,
        balanceSats: true,
        btcPayoutAddress: true,
        btcPayoutAddressSetAt: true,
        yookassaAccountId: true,
        cloudpaymentsPayoutCard: true,
        cloudpaymentsPayoutBoundAt: true,
        twoFactorEnabled: true,
        createdAt: true,
        _count: {
          select: {
            purchases: true,
            products: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedProfile })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при обновлении профиля" },
      { status: 500 }
    )
  }
}
