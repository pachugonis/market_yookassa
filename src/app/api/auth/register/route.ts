import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import crypto from "crypto"
import { sendVerificationEmail } from "@/lib/email"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

const registerSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа").max(100),
  // Приводим к нижнему регистру: вход ищет пользователя без учёта
  // регистра, и два аккаунта, различающихся только им, недопустимы.
  email: z
    .string()
    .email("Некорректный email")
    .max(255)
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов").max(200),
  role: z.enum(["BUYER", "SELLER"]).default("BUYER"),
})

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`register:${getClientIp(request)}`, 5, 60 * 60 * 1000)
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: "Слишком много регистраций. Попробуйте позже." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validatedData = registerSchema.parse(body)

    // Регистронезависимая проверка: иначе можно завести Admin@site.ru
    // при уже существующем admin@site.ru
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: validatedData.email, mode: "insensitive" } },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Пользователь с таким email уже существует" },
        { status: 400 }
      )
    }

    // Check if email verification is required
    const settings = await prisma.platformSettings.findFirst()
    const requireEmailVerification = settings?.requireEmailVerification ?? false

    const hashedPassword = await bcrypt.hash(validatedData.password, 12)

    // Generate verification token if required
    let verificationToken = null
    let verificationTokenExpires = null
    
    if (requireEmailVerification) {
      verificationToken = crypto.randomBytes(32).toString("hex")
      verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role as UserRole,
        verified: !requireEmailVerification, // Auto-verify if not required
        verificationToken,
        verificationTokenExpires,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        verified: true,
      },
    })

    // Send verification email if required
    if (requireEmailVerification && verificationToken) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
        const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`
        await sendVerificationEmail(user.email, user.name, verificationUrl)
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError)
        // Don't fail registration if email fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: user,
      requiresVerification: requireEmailVerification 
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || "Ошибка валидации" },
        { status: 400 }
      )
    }

    console.error("Registration error:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при регистрации" },
      { status: 500 }
    )
  }
}
