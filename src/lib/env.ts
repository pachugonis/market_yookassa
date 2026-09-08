/**
 * Проверка критичных переменных окружения при старте.
 *
 * Смысл в том, чтобы приложение падало при запуске с небезопасной
 * конфигурацией, а не работало месяцами с секретом из README.
 * Знание NEXTAUTH_SECRET позволяет подделать JWT с ролью ADMIN,
 * поэтому плейсхолдеры и короткие значения в продакшене недопустимы.
 */

const PLACEHOLDER_SECRETS = new Set([
  "your-super-secret-key-change-in-production",
  "changeme",
  "secret",
  "development",
])

const MIN_SECRET_LENGTH = 32

let cronSecretWarned = false

export function assertSecureEnv() {
  if (process.env.NODE_ENV !== "production") return

  const problems: string[] = []

  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET

  if (!secret) {
    problems.push("NEXTAUTH_SECRET не задан")
  } else if (PLACEHOLDER_SECRETS.has(secret.trim().toLowerCase())) {
    problems.push(
      "NEXTAUTH_SECRET содержит значение-плейсхолдер — сгенерируйте новый: openssl rand -base64 32"
    )
  } else if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(
      `NEXTAUTH_SECRET короче ${MIN_SECRET_LENGTH} символов — сгенерируйте новый: openssl rand -base64 32`
    )
  }

  if (!process.env.DATABASE_URL) {
    problems.push("DATABASE_URL не задан")
  }

  if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
    problems.push("YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY не заданы")
  }

  // Без секрета эндпоинт автоподтверждения отключён, и холды повиснут
  // до истечения срока — это не повод падать при старте, но знать надо.
  // Проверка вызывается на каждый рендер, поэтому предупреждаем однажды.
  if (!process.env.CRON_SECRET && !cronSecretWarned) {
    cronSecretWarned = true
    console.warn(
      "CRON_SECRET не задан: автоподтверждение сделок (/api/cron/settle-holds) отключено"
    )
  }

  if (problems.length > 0) {
    throw new Error(
      `Небезопасная конфигурация окружения:\n  - ${problems.join("\n  - ")}`
    )
  }
}
