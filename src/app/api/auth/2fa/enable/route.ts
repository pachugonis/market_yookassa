import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { authenticator } from "@otplib/preset-default"
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
    const { token, secret, backupCodes } = body

    if (!token || !secret || !backupCodes) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify the token
    const isValid = authenticator.verify({ token, secret })

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid verification code" },
        { status: 400 }
      )
    }

    // Hash backup codes before storing
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code: string) => bcrypt.hash(code, 10))
    )

    // Enable 2FA for the user
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorBackupCodes: hashedBackupCodes,
      }
    })

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication enabled successfully"
    })
  } catch (error) {
    console.error("2FA enable error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to enable 2FA" },
      { status: 500 }
    )
  }
}
