import nodemailer from "nodemailer"
import { prisma } from "./prisma"
import { getSiteName } from "./site-settings"

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Экранирует значения, попадающие в HTML письма. Имя пользователя и
 * название товара задаются самими пользователями: без экранирования
 * туда можно вписать разметку и ссылки.
 */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function sendEmail(options: EmailOptions) {
  try {
    // Get email settings from database
    const settings = await prisma.platformSettings.findFirst()

    if (!settings || !settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      throw new Error("Email настройки не сконфигурированы")
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
    })

    // Отправитель: своё имя из настроек почты, иначе — название площадки.
    const info = await transporter.sendMail({
      from: `${settings.fromName || (await getSiteName())} <${settings.fromEmail || settings.smtpUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Error sending email:", error)
    throw error
  }
}

export async function sendPurchaseEmail(
  buyerEmail: string,
  productTitle: string,
  downloadUrl: string
) {
  const siteName = escapeHtml(await getSiteName())

  return sendEmail({
    to: buyerEmail,
    subject: `Покупка: ${productTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Спасибо за покупку!</h2>
        <p>Вы успешно приобрели: <strong>${escapeHtml(productTitle)}</strong></p>
        <p>Скачать товар можно по ссылке:</p>
        <a href="${encodeURI(downloadUrl)}" style="display: inline-block; padding: 10px 20px; background: #0070f3; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">
          Скачать
        </a>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          С уважением,<br>
          Команда ${siteName}
        </p>
      </div>
    `,
  })
}

export async function sendPayoutRequestEmail(
  adminEmail: string,
  sellerName: string,
  amount: number
) {
  const siteName = escapeHtml(await getSiteName())

  return sendEmail({
    to: adminEmail,
    subject: "Новый запрос на выплату",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Новый запрос на выплату</h2>
        <p>Продавец <strong>${escapeHtml(sellerName)}</strong> запросил выплату на сумму <strong>${amount} ₽</strong></p>
        <p>Пожалуйста, обработайте запрос в панели администратора.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          ${siteName} Admin Panel
        </p>
      </div>
    `,
  })
}

export async function sendNewProductNotification(
  adminEmail: string,
  sellerName: string,
  productTitle: string
) {
  const siteName = escapeHtml(await getSiteName())

  return sendEmail({
    to: adminEmail,
    subject: "Новый товар загружен",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Новый товар</h2>
        <p>Продавец <strong>${escapeHtml(sellerName)}</strong> загрузил новый товар: <strong>${escapeHtml(productTitle)}</strong></p>
        <p>Проверьте товар в панели администратора.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          ${siteName} Admin Panel
        </p>
      </div>
    `,
  })
}

export async function sendVerificationEmail(
  userEmail: string,
  userName: string,
  verificationUrl: string
) {
  const siteName = escapeHtml(await getSiteName())

  return sendEmail({
    to: userEmail,
    subject: "Подтвердите вашу регистрацию",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Добро пожаловать, ${escapeHtml(userName)}!</h2>
        <p>Спасибо за регистрацию на ${siteName}!</p>
        <p>Пожалуйста, подтвердите ваш email адрес, нажав на кнопку ниже:</p>
        <a href="${encodeURI(verificationUrl)}" style="display: inline-block; padding: 12px 24px; background: #0070f3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Подтвердить Email
        </a>
        <p>Или скопируйте и вставьте эту ссылку в браузер:</p>
        <p style="color: #666; word-break: break-all;">${escapeHtml(verificationUrl)}</p>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">Если вы не регистрировались на ${siteName}, просто проигнорируйте это письмо.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          С уважением,<br>
          Команда ${siteName}
        </p>
      </div>
    `,
  })
}
