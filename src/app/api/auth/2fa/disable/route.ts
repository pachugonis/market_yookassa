import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { password } = body

    if (!password) {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      )
    }

    // Verify user's password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true, twoFactorEnabled: true }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: "2FA is not enabled" },
        { status: 400 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid password" },
        { status: 400 }
      )
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      }
    })

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication disabled successfully"
    })
  } catch (error) {
    console.error("2FA disable error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to disable 2FA" },
      { status: 500 }
    )
  }
}
