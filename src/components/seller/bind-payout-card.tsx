"use client"

import { useCallback, useRef, useState } from "react"
import Script from "next/script"
import { CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CLOUDPAYMENTS_WIDGET_SRC,
  type CloudPaymentsIntent,
} from "@/lib/cloudpayments-widget"

/**
 * Привязка карты продавца для выплат CloudPayments.
 *
 * Токен карты выдаётся только по факту оплаты, поэтому карта
 * проверяется авторизацией на символическую сумму: деньги
 * замораживаются, площадка забирает токен и тут же снимает холд.
 * Карточные данные вводятся в виджете и до нас не доходят.
 */

interface BindPayoutCardProps {
  /** Маска привязанной карты, если она уже есть. */
  cardMask: string | null
  boundAt: string | null
  commissionRate: number
  onChange: (card: { cardMask: string | null; boundAt: string | null }) => void
}

export function BindPayoutCard({
  cardMask,
  boundAt,
  commissionRate,
  onChange,
}: BindPayoutCardProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const scriptReady = useRef(false)

  const bindCard = useCallback(async () => {
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const res = await fetch("/api/payments/cloudpayments/bind-card", {
        method: "POST",
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || "Не удалось начать привязку карты")
        return
      }

      if (!scriptReady.current || !window.cp) {
        setError("Платёжная форма ещё загружается, попробуйте ещё раз")
        return
      }

      const { bindingId, publicTerminalId, amount, accountId } = data.data

      const intent: CloudPaymentsIntent = {
        publicTerminalId,
        amount,
        currency: "RUB",
        culture: "ru-RU",
        // Двухстадийная схема: сумма только замораживается и снимается
        // сразу после того, как мы получили токен.
        paymentSchema: "Dual",
        description: "Проверка карты для выплат",
        externalId: bindingId,
        tokenize: true,
        userInfo: { accountId },
      }

      const widget = new window.cp.CloudPayments()
      const result = await widget.start(intent)

      if (result?.type === "cancel") {
        setNotice("Привязка отменена")
        return
      }

      const transactionId = result?.data?.transactionId

      if (result?.status !== "success" || !transactionId) {
        setError(result?.message ?? "Банк отклонил проверку карты")
        return
      }

      // Уведомление CloudPayments сделает то же самое, но продавцу
      // не нужно его ждать.
      const complete = await fetch(
        "/api/payments/cloudpayments/bind-card/complete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bindingId, transactionId }),
        }
      )
      const completed = await complete.json()

      if (!completed.success) {
        setError(completed.error || "Не удалось привязать карту")
        return
      }

      onChange({
        cardMask: completed.data.cardMask ?? null,
        boundAt: new Date().toISOString(),
      })
      setNotice("Карта привязана, проверочная сумма разблокирована")
    } catch (bindError) {
      console.error("Error binding payout card:", bindError)
      setError("Не удалось привязать карту")
    } finally {
      setBusy(false)
    }
  }, [onChange])

  const unbindCard = useCallback(async () => {
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const res = await fetch("/api/payments/cloudpayments/bind-card", {
        method: "DELETE",
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || "Не удалось отвязать карту")
        return
      }

      onChange({ cardMask: null, boundAt: null })
      setNotice("Карта отвязана")
    } catch (unbindError) {
      console.error("Error unbinding payout card:", unbindError)
      setError("Не удалось отвязать карту")
    } finally {
      setBusy(false)
    }
  }, [onChange])

  return (
    <div className="space-y-4">
      <Script
        src={CLOUDPAYMENTS_WIDGET_SRC}
        onReady={() => {
          scriptReady.current = true
        }}
      />

      <div>
        <p className="font-medium">Карта для выплат CloudPayments</p>
        <p className="text-sm text-muted-foreground">
          Привяжите карту — на неё уйдёт ваша доля, когда покупатель
          подтвердит сделку. Для проверки карты банк заморозит небольшую
          сумму и сразу её вернёт.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={bindCard} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              {cardMask ? "Привязать другую карту" : "Привязать карту"}
            </>
          )}
        </Button>

        {cardMask && (
          <Button variant="outline" onClick={unbindCard} disabled={busy}>
            Отвязать
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && !error && (
        <p className="text-sm text-muted-foreground">{notice}</p>
      )}

      <div className="p-4 bg-secondary/50 rounded-xl text-sm text-muted-foreground">
        {cardMask ? (
          <>
            Выплаты включены: карта •••• {cardMask}
            {boundAt &&
              `, привязана ${new Date(boundAt).toLocaleDateString("ru-RU")}`}
            . При подтверждении сделки {100 - commissionRate}% суммы уходят
            на неё, а {commissionRate}% остаются площадке как комиссия.
          </>
        ) : (
          <>
            Карта не привязана: оплаты через CloudPayments будут зачисляться
            на внутренний баланс, а вывод — по заявке ниже.
          </>
        )}
      </div>
    </div>
  )
}
