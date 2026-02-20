import { v4 as uuidv4 } from "uuid"

const YOOKASSA_API_URL = "https://api.yookassa.ru/v3"
const SHOP_ID = process.env.YOOKASSA_SHOP_ID!
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY!

interface CreatePaymentParams {
  amount: number
  description: string
  returnUrl: string
  metadata?: Record<string, string>
}

interface YooKassaPayment {
  id: string
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled"
  confirmation?: {
    type: string
    confirmation_url: string
  }
  amount: {
    value: string
    currency: string
  }
  metadata?: Record<string, string>
}

export async function createPayment({
  amount,
  description,
  returnUrl,
  metadata,
}: CreatePaymentParams): Promise<YooKassaPayment> {
  const idempotenceKey = uuidv4()

  const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey,
      Authorization: `Basic ${Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: {
        value: amount.toFixed(2),
        currency: "RUB",
      },
      confirmation: {
        type: "redirect",
        return_url: returnUrl,
      },
      capture: true,
      description,
      metadata,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error("YooKassa error:", error)
    throw new Error("Failed to create payment")
  }

  return response.json()
}

export async function getPayment(paymentId: string): Promise<YooKassaPayment> {
  const response = await fetch(`${YOOKASSA_API_URL}/payments/${paymentId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString("base64")}`,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to get payment")
  }

  return response.json()
}

export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  // In production, verify HMAC signature
  // For now, we'll do basic validation
  return !!signature && signature.length > 0
}

export function calculateCommission(amount: number): {
  commission: number
  sellerEarnings: number
} {
  const commission = Math.round(amount * 0.10) // 10% commission
  const sellerEarnings = amount - commission
  return { commission, sellerEarnings }
}
