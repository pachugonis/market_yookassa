import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import nodemailer from "nodemailer"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { smtpHost, smtpPort, smtpUser, smtpPassword, fromEmail, fromName } = body

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return NextResponse.json(
        { success: false, error: "Пожалуйста, заполните все обязательные поля SMTP" },
        { status: 400 }
      )
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort || 587,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })

    // Verify connection
    await transporter.verify()

    // Send test email
    await transporter.sendMail({
      from: `${fromName || "DigiMarket"} <${fromEmail || smtpUser}>`,
      to: session.user.email,
      subject: "Тестовое письмо - DigiMarket",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Тестовое письмо</h2>
          <p>Это тестовое письмо от DigiMarket.</p>
          <p>Если вы получили это письмо, значит настройки SMTP работают корректно!</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Отправлено из панели администратора DigiMarket<br>
            ${new Date().toLocaleString('ru-RU')}
          </p>
        </div>
      `,
    })

    return NextResponse.json({
      success: true,
      message: `Тестовое письмо отправлено на ${session.user.email}`,
    })
  } catch (error: any) {
    console.error("Error sending test email:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Ошибка отправки письма",
      },
      { status: 500 }
    )
  }
}
