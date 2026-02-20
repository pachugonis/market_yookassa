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
