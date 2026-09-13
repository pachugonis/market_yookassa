"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Script from "next/script"
import { Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  CLOUDPAYMENTS_WIDGET_SRC,
  type CloudPaymentsIntent,
} from "@/lib/cloudpayments-widget"
import { DISPUTE_WINDOW_HOURS } from "@/lib/dispute-window"

/**
 * Запуск платёжного виджета CloudPayments.
 *
 * Виджет — единственный способ передать параметры «Безопасной сделки»
 * и двухстадийной схемы, поэтому оплата идёт с нашей страницы, а не по
 * ссылке провайдера. Все параметры приходят с сервера: здесь они только
 * передаются виджету.
 */

type Stage = "loading" | "running" | "done" | "failed"

export function CloudPaymentsCheckout({
  intent,
  productTitle,
  productId,
  amount,
  successUrl,
  instantCapture,
}: {
  intent: CloudPaymentsIntent
  productTitle: string
  productId: string
  amount: number
  successUrl: string
  /** Списание идёт сразу после оплаты, без подтверждения приёма. */
  instantCapture: boolean
}) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>("loading")
  const [error, setError] = useState<string | null>(null)
  // Виджет открывается один раз сам: повторный запуск — только по кнопке.
  const autoStarted = useRef(false)

  const startPayment = useCallback(async () => {
    if (!window.cp) {
      setStage("failed")
      setError("Не удалось загрузить платёжную форму")
      return
    }

    setStage("running")
    setError(null)

    try {
      const widget = new window.cp.CloudPayments()
      const result = await widget.start(intent)

      if (result?.status === "success") {
        setStage("done")
        // Средства заморожены: покупку в HELD переводит уведомление,
        // а страница успеха дожидается этого опросом статуса.
        router.push(successUrl)
        return
      }

      if (result?.type === "cancel") {
        // Покупатель закрыл форму — возвращаем его к товару.
        router.replace(`/products/${productId}`)
        return
      }

      setStage("failed")
      setError(result?.message ?? "Платёж не прошёл")
    } catch (widgetError) {
      console.error("CloudPayments widget error:", widgetError)
      setStage("failed")
      setError("Не удалось провести платёж")
    }
  }, [intent, productId, router, successUrl])

  // Виджет открывается сразу, как только загрузится его скрипт: кнопку
  // «Купить» покупатель уже нажал на странице товара.
  const startOnce = useCallback(() => {
    if (autoStarted.current) return
    autoStarted.current = true
    void startPayment()
  }, [startPayment])

  return (
    <div className="container mx-auto px-4 py-16">
      <Script
        src={CLOUDPAYMENTS_WIDGET_SRC}
        onReady={startOnce}
        onError={() => {
          setStage("failed")
          setError("Не удалось загрузить платёжную форму")
        }}
      />

      <div className="max-w-md mx-auto">
        <Card className="border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            {(stage === "loading" || stage === "running" || stage === "done") && (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Оплата через CloudPayments</h1>
                <p className="text-muted-foreground">
                  {stage === "done"
                    ? "Платёж принят, открываем вашу покупку..."
                    : "Открываем платёжную форму..."}
                </p>
              </>
            )}

            {stage === "failed" && (
              <>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-red-100">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Платёж не прошёл</h1>
                <p className="text-muted-foreground mb-6">
                  {error ??
                    (instantCapture
                      ? `«${productTitle}» — ${amount.toLocaleString("ru-RU")} ₽. Товар
                         откроется сразу после оплаты, а на спор останется
                         ${DISPUTE_WINDOW_HOURS} часа.`
                      : `«${productTitle}» — ${amount.toLocaleString("ru-RU")} ₽. Деньги
                         будут заморожены на карте и уйдут продавцу только после того,
                         как вы подтвердите получение товара.`)}
                </p>
                <div className="space-y-3">
                  <Button className="w-full" size="lg" onClick={startPayment}>
                    Оплатить
                  </Button>
                  <Link href={`/products/${productId}`}>
                    <Button variant="outline" className="w-full">
                      Вернуться к товару
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
