import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { authenticator } from "@otplib/preset-default"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { rateLimit, resetRateLimit, getClientIp } from "@/lib/rate-limit"
import { assertSecureEnv } from "@/lib/env"

// В продакшене отказываемся стартовать с небезопасными секретами
assertSecureEnv()

// Допуск в один шаг (±30 с) на расхождение часов клиента
authenticator.options = { window: 1 }

/**
 * Хэш-заглушка: прогоняем bcrypt даже когда пользователь не найден,
 * чтобы время ответа не выдавало существование аккаунта.
 */
const DUMMY_HASH = "$2b$12$S63ImyJnlxhc159A.2PPc.qjXXDQ.JqI9aUX7mqeoUVrkP55jsLQ2"

/**
 * Ошибка входа с машиночитаемым кодом. Код попадает в ответ signIn()
 * как поле `code` — по нему клиент решает, показывать ли поле для
 * одноразового кода. Ничего чувствительного в коды не кладём.
 */
class LoginError extends CredentialsSignin {
  constructor(code: string) {
    super()
    this.code = code
  }
}

const LOGIN_ATTEMPT_LIMIT = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        twoFactorToken: { label: "2FA code", type: "text" },
        isBackupCode: { label: "Use backup code", type: "text" },
      },
      async authorize(credentials, request) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : ""
        const password =
          typeof credentials?.password === "string" ? credentials.password : ""

        if (!email || !password) {
          throw new LoginError("invalid_credentials")
        }

        // Ограничиваем перебор и по IP, и по конкретному аккаунту
        const ip = getClientIp(request)
        const ipLimit = rateLimit(`login:ip:${ip}`, 30, LOGIN_WINDOW_MS)
        const accountLimit = rateLimit(
          `login:email:${email}`,
          LOGIN_ATTEMPT_LIMIT,
          LOGIN_WINDOW_MS
        )

        if (!ipLimit.success || !accountLimit.success) {
          throw new LoginError("rate_limited")
        }

        // Регистронезависимый поиск: в базе могут быть записи,
        // созданные до нормализации email.
        const matches = await prisma.user.findMany({
          where: { email: { equals: email, mode: "insensitive" } },
          take: 2,
        })

        // Если исторически завелись два аккаунта, отличающиеся только
        // регистром, выбор «любого» из них — это потенциальный захват
        // чужого аккаунта. Такой вход блокируем.
        const user = matches.length === 1 ? matches[0] : null

        // Сравнение выполняем всегда — иначе по времени ответа
        // можно определить, существует ли аккаунт
        const isPasswordValid = await bcrypt.compare(
          password,
          user?.password ?? DUMMY_HASH
        )

        if (!user || !isPasswordValid) {
          throw new LoginError("invalid_credentials")
        }

        const settings = await prisma.platformSettings.findFirst({
          select: { requireEmailVerification: true },
        })

        if ((settings?.requireEmailVerification ?? false) && !user.verified) {
          throw new LoginError("email_not_verified")
        }

        // Вторым фактором распоряжается ТОЛЬКО сервер: без валидного
        // кода сессия не выдаётся, каким бы ни был клиент.
        if (user.twoFactorEnabled) {
          if (!user.twoFactorSecret) {
            // Некорректное состояние: 2FA включена, но секрета нет.
            // Впускать в этом случае нельзя.
            throw new LoginError("2fa_invalid")
          }

          const token =
            typeof credentials?.twoFactorToken === "string"
              ? credentials.twoFactorToken.replace(/\s+/g, "")
              : ""

          if (!token) {
            throw new LoginError("2fa_required")
          }

          // Отдельный, более жёсткий лимит на подбор шестизначного кода
          const otpLimit = rateLimit(`2fa:${user.id}`, 5, LOGIN_WINDOW_MS)
          if (!otpLimit.success) {
            throw new LoginError("rate_limited")
          }

          const useBackupCode = credentials?.isBackupCode === "true"
          const verified = useBackupCode
            ? await consumeBackupCode(user.id, user.twoFactorBackupCodes, token)
            : authenticator.verify({ token, secret: user.twoFactorSecret })

          if (!verified) {
            throw new LoginError("2fa_invalid")
          }

          resetRateLimit(`2fa:${user.id}`)
        }

        resetRateLimit(`login:email:${email}`)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.avatar,
        }
      },
    }),
  ],
  trustHost: true,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.picture = user.image
      }
      // Handle session updates (e.g., when avatar or name is changed)
      if (trigger === "update" && session) {
        if (session.image !== undefined) {
          token.picture = session.image
        }
        if (session.name !== undefined) {
          token.name = session.name
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.image = token.picture as string | null
        // Use name from token if available
        if (token.name) {
          session.user.name = token.name as string
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 часа
  },
})

/**
 * Проверяет резервный код и, если он подошёл, гасит его.
 * Код одноразовый, поэтому удаление обязательно.
 */
async function consumeBackupCode(
  userId: string,
  hashedCodes: string[],
  candidate: string
): Promise<boolean> {
  for (const hashedCode of hashedCodes) {
    const matches = await bcrypt.compare(candidate, hashedCode)
    if (!matches) continue

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorBackupCodes: hashedCodes.filter((code) => code !== hashedCode),
      },
    })
    return true
  }
  return false
}
