import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}

/**
 * Сатоши в биткоинах: 0.00123456 BTC. Считаем строкой, а не делением:
 * восьмой знак после запятой у float уже неточен.
 */
export function formatBtc(sats: number): string {
  const rounded = Math.round(sats)
  const sign = rounded < 0 ? "-" : ""
  const digits = Math.abs(rounded).toString().padStart(9, "0")

  return `${sign}${digits.slice(0, -8)}.${digits.slice(-8)} BTC`
}

/** Сатоши с разделителями разрядов: 1 234 567 сат. */
export function formatSats(sats: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(sats))} сат`
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function generateDownloadToken(): string {
  return crypto.randomUUID()
}

export function calculateCommission(amount: number): {
  commission: number
  sellerEarnings: number
} {
  const commission = Math.round(amount * 0.10)
  const sellerEarnings = amount - commission
  return { commission, sellerEarnings }
}
