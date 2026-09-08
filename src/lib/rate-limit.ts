import { NextRequest } from "next/server"

/**
 * Простой in-memory rate limiter (фиксированное окно).
 *
 * ВАЖНО: состояние живёт в памяти процесса. При горизонтальном
 * масштабировании (несколько реплик app) лимит будет действовать
 * на каждую реплику отдельно — для продакшена с несколькими
 * инстансами нужно вынести счётчики в Redis.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Периодическая очистка, чтобы Map не рос бесконечно
let lastSweep = Date.now()
const SWEEP_INTERVAL_MS = 60_000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * @param key      уникальный ключ (например `login:<ip>`)
 * @param limit    сколько попыток разрешено в окне
 * @param windowMs длина окна в миллисекундах
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  bucket.count += 1

  if (bucket.count > limit) {
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    }
  }

  return {
    success: true,
    remaining: limit - bucket.count,
    retryAfterSeconds: 0,
  }
}

/** Сбрасывает счётчик — вызывается после успешной аутентификации. */
export function resetRateLimit(key: string) {
  buckets.delete(key)
}

/**
 * IP клиента — только те значения, которые проставил НАШ прокси.
 *
 * Важно: X-Forwarded-For клиент может прислать сам. Nginx настроен как
 * `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`, то есть
 * дописывает настоящий $remote_addr В КОНЕЦ уже существующей цепочки.
 * Поэтому первый элемент подконтролен атакующему, а доверять можно
 * только последнему.
 *
 * X-Real-IP nginx перезаписывает целиком ($remote_addr), так что он
 * надёжнее — используем его в первую очередь.
 */
export function getClientIp(request: NextRequest | Request): string {
  const headers = request.headers

  const realIp = headers.get("x-real-ip")?.trim()
  if (realIp) return realIp

  const forwardedFor = headers.get("x-forwarded-for")
  if (forwardedFor) {
    const chain = forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)

    // Последний элемент дописан нашим прокси
    const last = chain[chain.length - 1]
    if (last) return last
  }

  return "unknown"
}
