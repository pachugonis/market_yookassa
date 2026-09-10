"use client"

import { useCallback, useEffect, useState } from "react"
import { Bitcoin, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatBtc, formatSats } from "@/lib/utils"

/**
 * Исходящие операции площадки: заявки продавцов на вывод биткоина и
 * ручные возвраты покупателям.
 *
 * Подписывает транзакции администратор в BTCPay — ключи кошелька
 * приложению не принадлежат. Здесь видно, что ждёт подписи, и отсюда
 * можно отклонить заявку (сатоши вернутся продавцу) или закрыть возврат,
 * отправленный вручную.
 */

interface PayoutRow {
  id: string
  asset: "RUB" | "BTC"
  kind: "SELLER_WITHDRAWAL" | "BUYER_REFUND"
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  amountSats: number | null
  feeSats: number | null
  netSats: number | null
  feeRate: number | null
  destination: string | null
  txId: string | null
  note: string | null
  purchaseId: string | null
  providerPayoutId: string | null
  requestedAt: string
  processedAt: string | null
  recipient: { id: string; name: string; email: string }
}

const STATUS: Record<
  PayoutRow["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Ждёт подписи", variant: "secondary" },
  PROCESSING: { label: "Отправляется", variant: "secondary" },
  COMPLETED: { label: "Отправлено", variant: "default" },
  FAILED: { label: "Отклонено", variant: "destructive" },
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [btcpayUrl, setBtcpayUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refundForm, setRefundForm] = useState<
    Record<string, { destination: string; txId: string }>
  >({})

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/payouts")
      const data = await res.json()

      if (data.success) {
        setPayouts(data.data.payouts)
        setBtcpayUrl(data.data.btcpayUrl)
      }
    } catch (loadError) {
      console.error("Error loading payouts:", loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = async (
    id: string,
    body: Record<string, unknown>,
    confirmText?: string
  ) => {
    if (confirmText && !window.confirm(confirmText)) return

    setBusyId(id)
    setError(null)

    try {
      const res = await fetch(`/api/admin/payouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || "Не удалось выполнить действие")
        return
      }

      await load()
    } catch (actionError) {
      console.error("Error updating payout:", actionError)
      setError("Не удалось выполнить действие")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const pending = payouts.filter(
    (payout) => payout.status === "PENDING" || payout.status === "PROCESSING"
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Выплаты</h1>
          <p className="text-muted-foreground">
            Выводы продавцов и возвраты покупателям. Транзакции подписываются
            в BTCPay — {pending.length} в работе.
          </p>
        </div>

        {btcpayUrl && (
          <Button asChild variant="outline">
            <a href={btcpayUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Открыть BTCPay
            </a>
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {payouts.length === 0 && (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            Заявок пока нет.
          </CardContent>
        </Card>
      )}

      {payouts.map((payout) => {
        const isRefund = payout.kind === "BUYER_REFUND"
        const form = refundForm[payout.id] ?? { destination: "", txId: "" }

        return (
          <Card key={payout.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <Bitcoin className="h-5 w-5 text-orange-500" />
                {isRefund ? "Возврат покупателю" : "Вывод продавца"}
                <Badge variant={STATUS[payout.status].variant}>
                  {STATUS[payout.status].label}
                </Badge>
                <span className="text-muted-foreground font-normal">
                  {payout.recipient.name} · {payout.recipient.email}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">К отправке: </span>
                  {formatBtc(payout.netSats ?? 0)}
                </div>
                {payout.feeSats !== null && (
                  <div>
                    <span className="text-muted-foreground">
                      Удержано за сеть:{" "}
                    </span>
                    {formatSats(payout.feeSats)}
                    {payout.feeRate ? ` (${payout.feeRate.toFixed(1)} сат/vB)` : ""}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Списано с баланса: </span>
                  {formatSats(payout.amountSats ?? 0)}
                </div>
                <div>
                  <span className="text-muted-foreground">Заявка: </span>
                  {new Date(payout.requestedAt).toLocaleString("ru-RU")}
                </div>
                <div className="sm:col-span-2 break-all">
                  <span className="text-muted-foreground">Адрес: </span>
                  {payout.destination ?? "не указан — запросите у получателя"}
                </div>
                {payout.purchaseId && (
                  <div className="sm:col-span-2 break-all">
                    <span className="text-muted-foreground">Сделка: </span>
                    {payout.purchaseId}
                  </div>
                )}
                {payout.txId && (
                  <div className="sm:col-span-2 break-all">
                    <span className="text-muted-foreground">Транзакция: </span>
                    {payout.txId}
                  </div>
                )}
                {payout.note && (
                  <div className="sm:col-span-2 text-muted-foreground">
                    {payout.note}
                  </div>
                )}
              </div>

              {payout.status !== "COMPLETED" && payout.status !== "FAILED" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {!isRefund && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === payout.id}
                        onClick={() => act(payout.id, { action: "refresh" })}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Обновить статус
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === payout.id}
                        onClick={() =>
                          act(
                            payout.id,
                            { action: "cancel" },
                            "Отклонить заявку? Сатоши вернутся на баланс продавца."
                          )
                        }
                      >
                        Отклонить
                      </Button>
                    </>
                  )}

                  {isRefund && (
                    <div className="w-full space-y-2">
                      <p className="text-muted-foreground">
                        Отправьте {formatBtc(payout.netSats ?? 0)} покупателю
                        из кошелька площадки, затем отметьте возврат
                        выполненным.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          value={form.destination}
                          placeholder="Адрес покупателя"
                          spellCheck={false}
                          onChange={(e) =>
                            setRefundForm((current) => ({
                              ...current,
                              [payout.id]: { ...form, destination: e.target.value },
                            }))
                          }
                        />
                        <Input
                          value={form.txId}
                          placeholder="Хеш транзакции"
                          spellCheck={false}
                          onChange={(e) =>
                            setRefundForm((current) => ({
                              ...current,
                              [payout.id]: { ...form, txId: e.target.value },
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          disabled={busyId === payout.id}
                          onClick={() =>
                            act(payout.id, {
                              action: "complete",
                              destination: form.destination,
                              txId: form.txId,
                            })
                          }
                        >
                          Возврат отправлен
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
