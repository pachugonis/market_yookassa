"use client"

import { useCallback, useEffect, useState } from "react"
import { Bitcoin, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatBtc, formatSats } from "@/lib/utils"

/**
 * Биткоиновый баланс продавца и вывод на его кошелёк.
 *
 * Оплата биткоином не сплитуется: платёж целиком приходит в кошелёк
 * площадки, а доля продавца копится здесь — в сатоши, зафиксированных
 * в момент сделки. Курс после неё на сумму уже не влияет.
 *
 * Комиссия сети удерживается из суммы вывода и показывается до
 * подтверждения: она считается по текущей загрузке сети, поэтому
 * котировка живёт ограниченное время.
 */

interface Quote {
  balanceSats: number
  feeSats: number
  feeRate: number
  minPayoutSats: number
  quoteMinutes: number
  maxNetSats: number
}

interface PayoutRow {
  id: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  amountSats: number | null
  feeSats: number | null
  netSats: number | null
  destination: string | null
  txId: string | null
  note: string | null
  requestedAt: string
  processedAt: string | null
}

const STATUS_LABELS: Record<PayoutRow["status"], string> = {
  PENDING: "Ждёт подтверждения",
  PROCESSING: "Отправляется",
  COMPLETED: "Отправлено",
  FAILED: "Отклонено",
}

export function BtcPayout() {
  const [loading, setLoading] = useState(true)
  const [balanceSats, setBalanceSats] = useState(0)
  const [address, setAddress] = useState("")
  const [savedAddress, setSavedAddress] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [savingAddress, setSavingAddress] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/payouts/btc")
      const data = await res.json()

      if (!data.success) return

      setBalanceSats(data.data.balanceSats)
      setSavedAddress(data.data.address)
      setAddress((current) => current || data.data.address || "")
      setQuote(data.data.quote)
      setQuoteError(data.data.quoteError)
      setPayouts(data.data.payouts)
    } catch (loadError) {
      console.error("Error loading BTC payouts:", loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveAddress = async () => {
    setSavingAddress(true)
    setError(null)
    setNotice(null)

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ btcPayoutAddress: address.trim() }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || "Не удалось сохранить адрес")
        return
      }

      setSavedAddress(data.data.btcPayoutAddress ?? null)
      setNotice(
        data.data.btcPayoutAddress
          ? "Адрес сохранён"
          : "Адрес удалён — вывод недоступен"
      )
    } catch (saveError) {
      console.error("Error saving BTC address:", saveError)
      setError("Не удалось сохранить адрес")
    } finally {
      setSavingAddress(false)
    }
  }

  const withdraw = async () => {
    setWithdrawing(true)
    setError(null)
    setNotice(null)

    try {
      const res = await fetch("/api/payouts/btc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || "Не удалось создать заявку")
        return
      }

      setNotice(
        "Заявка создана. Деньги уйдут после того, как её подтвердит администратор"
      )
      await load()
    } catch (withdrawError) {
      console.error("Error requesting BTC payout:", withdrawError)
      setError("Не удалось создать заявку")
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загружаем биткоин-баланс…
      </div>
    )
  }

  const netSats = quote ? Math.max(balanceSats - quote.feeSats, 0) : 0
  const canWithdraw =
    Boolean(savedAddress) && Boolean(quote) && netSats >= (quote?.minPayoutSats ?? 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-xl">
          <Bitcoin className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <p className="font-medium">Биткоин-баланс</p>
          <p className="text-sm text-muted-foreground">
            {formatBtc(balanceSats)} · {formatSats(balanceSats)}
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-2">
          Кошелёк для вывода. Отправляем на него всю доступную сумму
          за вычетом комиссии сети.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="bc1…"
            spellCheck={false}
          />
          <Button
            variant="outline"
            onClick={saveAddress}
            disabled={savingAddress || address.trim() === (savedAddress ?? "")}
          >
            {savingAddress ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Сохранить"
            )}
          </Button>
        </div>
      </div>

      <div className="p-4 bg-secondary/50 rounded-xl text-sm space-y-1">
        {quote ? (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Комиссия сети</span>
              <span>
                {formatSats(quote.feeSats)} ({quote.feeRate.toFixed(1)} сат/vB)
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span>К получению</span>
              <span>{formatBtc(netSats)}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Оценка действует около {quote.quoteMinutes} мин: комиссия зависит
              от загрузки сети. Минимальная сумма к получению —{" "}
              {formatSats(quote.minPayoutSats)}.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            {quoteError ?? "Комиссия сети сейчас неизвестна"}
          </p>
        )}
      </div>

      <Button className="w-full" onClick={withdraw} disabled={!canWithdraw || withdrawing}>
        {withdrawing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Вывести {formatBtc(netSats)}
          </>
        )}
      </Button>

      {!savedAddress && (
        <p className="text-sm text-center text-muted-foreground">
          Сохраните биткоин-адрес, чтобы вывести средства
        </p>
      )}

      {savedAddress && quote && netSats < quote.minPayoutSats && (
        <p className="text-sm text-center text-muted-foreground">
          Накопите минимум {formatSats(quote.minPayoutSats + quote.feeSats)} —
          меньшую сумму съедает комиссия сети
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && !error && (
        <p className="text-sm text-muted-foreground">{notice}</p>
      )}

      {payouts.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-sm">Заявки на вывод</p>
          {payouts.map((payout) => (
            <div
              key={payout.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{formatBtc(payout.netSats ?? 0)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {new Date(payout.requestedAt).toLocaleString("ru-RU")}
                  {payout.destination ? ` · ${payout.destination}` : ""}
                </p>
                {payout.note && (
                  <p className="text-xs text-muted-foreground">{payout.note}</p>
                )}
              </div>
              <span
                className={
                  payout.status === "COMPLETED"
                    ? "text-green-600 shrink-0"
                    : payout.status === "FAILED"
                      ? "text-destructive shrink-0"
                      : "text-muted-foreground shrink-0"
                }
              >
                {STATUS_LABELS[payout.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
