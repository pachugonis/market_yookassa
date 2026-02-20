import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { twoFactorEnabled: true }
    })

    return NextResponse.json({
      success: true,
      twoFactorEnabled: user?.twoFactorEnabled || false
    })
  } catch (error) {
    console.error("Check 2FA error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to check 2FA status" },
      { status: 500 }
    )
  }
}
