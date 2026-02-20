import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { authenticator } from "@otplib/preset-default"
import QRCode from "qrcode"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Generate 2FA secret
    const secret = authenticator.generateSecret()
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    // Generate OTP auth URL
    const otpauth = authenticator.keyuri(
      user.email,
      "DigiMarket",
      secret
    )

    // Generate QR code
    const qrCode = await QRCode.toDataURL(otpauth)

    // Generate backup codes (10 codes)
    const backupCodes = Array.from({ length: 10 }, () => {
      return crypto.randomBytes(4).toString("hex").toUpperCase()
    })

    return NextResponse.json({
      success: true,
      data: {
        secret,
        qrCode,
        backupCodes,
      }
    })
  } catch (error) {
    console.error("2FA setup error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to setup 2FA" },
      { status: 500 }
    )
  }
}
