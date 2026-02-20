import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticator } from "@otplib/preset-default"
import bcrypt from "bcryptjs"
import { signIn } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, token, isBackupCode } = body

    if (!email || !token) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      }
    })

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400 }
      )
    }

    let isValid = false

    if (isBackupCode) {
      // Verify backup code
      for (const hashedCode of user.twoFactorBackupCodes) {
        const matches = await bcrypt.compare(token, hashedCode)
        if (matches) {
          isValid = true
          // Remove used backup code
          const updatedCodes = user.twoFactorBackupCodes.filter(
            code => code !== hashedCode
          )
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorBackupCodes: updatedCodes }
          })
          break
        }
      }
    } else {
      // Verify TOTP token
      isValid = authenticator.verify({
        token,
        secret: user.twoFactorSecret
      })
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid verification code" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Verification successful"
    })
  } catch (error) {
    console.error("2FA verification error:", error)
    return NextResponse.json(
      { success: false, error: "Verification failed" },
      { status: 500 }
    )
  }
}
