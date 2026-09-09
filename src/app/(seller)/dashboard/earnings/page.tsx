"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Wallet, TrendingUp, Percent, Loader2, CreditCard, Split } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BindPayoutCard } from "@/components/seller/bind-payout-card"
import { BtcPayout } from "@/components/seller/btc-payout"
import { formatPrice, formatBtc } from "@/lib/utils"

interface Stats {
  balance: number
  totalEarnings: number
  totalSales: number
  commissionRate?: number
  /** Выручка по сделкам, где деньги ещё заморожены у покупателя */
  heldEarnings?: number
  heldCount?: number
  /** Биткоин-выручка живёт отдельным балансом в сатоши */
  balanceSats?: number
  earnedSats?: number
  heldSats?: number
  heldSatsCount?: number
}

export default function EarningsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [commissionRate, setCommissionRate] = useState(10)
  const [minPayoutAmount, setMinPayoutAmount] = useState(100000)
  const [splitAccountId, setSplitAccountId] = useState("")
  const [savedAccountId, setSavedAccountId] = useState<string | null>(null)
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [payoutCard, setPayoutCard] = useState<{
    cardMask: string | null
    boundAt: string | null
  }>({ cardMask: null, boundAt: null })
  const [cardBindingAvailable, setCardBindingAvailable] = useState(false)
  const [btcAvailable, setBtcAvailable] = useState(false)

  useEffect(() => {
    fetchStats()
    fetchCommissionRate()
    fetchPayoutAccount()
    fetchCardBinding()
  }, [])

  const fetchCardBinding = async () => {
    try {
      const res = await fetch("/api/payments/providers")
      const data = await res.json()
      if (data.success) {
        setCardBindingAvailable(Boolean(data.data.cardBinding))
        setBtcAvailable(
          data.data.providers.some(
            (provider: { id: string }) => provider.id === "BTCPAY"
          )
        )
      }
    } catch (error) {
      console.error("Error fetching payment providers:", error)
    }
  }

  const fetchPayoutAccount = async () => {
    try {
      const res = await fetch("/api/profile")
      const data = await res.json()
      if (data.success) {
        setSavedAccountId(data.data.yookassaAccountId ?? null)
        setSplitAccountId(data.data.yookassaAccountId ?? "")
        setPayoutCard({
          cardMask: data.data.cloudpaymentsPayoutCard ?? null,
          boundAt: data.data.cloudpaymentsPayoutBoundAt ?? null,
        })
      }
    } catch (error) {
      console.error("Error fetching payout account:", error)
    }
  }

  const savePayoutAccount = async () => {
    setSavingAccount(true)
    setAccountError(null)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yookassaAccountId: splitAccountId.trim() }),
      })
      const data = await res.json()

      if (data.success) {
        setSavedAccountId(data.data.yookassaAccountId ?? null)
      } else {
        setAccountError(data.error || "Не удалось сохранить счёт")
      }
    } catch (error) {
      console.error("Error saving payout account:", error)
      setAccountError("Не удалось сохранить счёт")
    } finally {
      setSavingAccount(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/seller/stats")
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCommissionRate = async () => {
    try {
      const res = await fetch("/api/admin/settings")
      const data = await res.json()
      if (data.success && data.data) {
        setCommissionRate(data.data.commissionRate)
        setMinPayoutAmount(data.data.minPayoutAmount || 100000)
      }
    } catch (error) {
      console.error("Error fetching commission rate:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const sellerPercentage = 100 - commissionRate
  const commission = stats?.totalEarnings 
    ? Math.round((stats.totalEarnings / sellerPercentage) * commissionRate) 
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Доходы</h1>
        <p className="text-muted-foreground">Ваш заработок и баланс</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Wallet className="h-6 w-6" />
                </div>
                <span className="font-medium">Доступный баланс</span>
              </div>
              <p className="text-4xl font-bold">{formatPrice(stats?.balance || 0)}</p>
              {(stats?.heldCount || 0) > 0 && (
                <p className="text-sm text-white/80 mt-2">
                  Ещё {formatPrice(stats?.heldEarnings || 0)} ждут подтверждения
                  покупателями ({stats?.heldCount})
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-muted-foreground">Всего заработано</span>
              </div>
              <p className="text-3xl font-bold">{formatPrice(stats?.totalEarnings || 0)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-xl">
                  <Percent className="h-6 w-6 text-orange-600" />
                </div>
                <span className="text-muted-foreground">Комиссия платформы</span>
              </div>
              <p className="text-3xl font-bold">{formatPrice(commission)}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Сплитование: реквизиты продавца у платёжных сервисов */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Split className="h-5 w-5" />
              Реквизиты для сплитования
            </CardTitle>
            <CardDescription>
              Укажите реквизиты у того сервиса, через который покупатели
              оплачивают ваши товары: выручка будет приходить вам напрямую
              при каждой сделке, а площадка удержит только комиссию.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium">Счёт в «ЮKassa для платформ»</p>
              <p className="text-sm text-muted-foreground">
                Идентификатор вашего магазина в ЮKassa — на него уходит
                выручка при оплате через ЮKassa.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={splitAccountId}
                onChange={(e) => setSplitAccountId(e.target.value)}
                placeholder="Например, 1000001"
                inputMode="numeric"
              />
              <Button onClick={savePayoutAccount} disabled={savingAccount}>
                {savingAccount ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Сохранить"
                )}
              </Button>
            </div>

            {accountError && (
              <p className="text-sm text-destructive">{accountError}</p>
            )}

            <div className="p-4 bg-secondary/50 rounded-xl text-sm text-muted-foreground">
              {savedAccountId ? (
                <>
                  Сплитование включено: после подтверждения сделки покупателем{" "}
                  {100 - commissionRate}% суммы уходят на ваш счёт в ЮKassa, а{" "}
                  {commissionRate}% удерживает площадка. Внутренний баланс и
                  заявки на вывод при этом не используются.
                </>
              ) : (
                <>
                  Счёт не подключён: деньги приходят на счёт площадки и
                  зачисляются на ваш внутренний баланс — вывести их можно
                  заявкой ниже. Оставьте поле пустым, чтобы отключить сплит.
                </>
              )}
            </div>

            {cardBindingAvailable && (
              <div className="pt-2 border-t">
                <BindPayoutCard
                  cardMask={payoutCard.cardMask}
                  boundAt={payoutCard.boundAt}
                  commissionRate={commissionRate}
                  onChange={setPayoutCard}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Биткоин: отдельный баланс и вывод на кошелёк продавца */}
      {btcAvailable && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Вывод биткоина</CardTitle>
              <CardDescription>
                Оплата биткоином приходит в кошелёк площадки, а ваша доля
                копится здесь в сатоши — она зафиксирована в момент сделки
                и от курса больше не зависит.
                {(stats?.heldSatsCount || 0) > 0 && (
                  <>
                    {" "}
                    Ещё {formatBtc(stats?.heldSats || 0)} ждут подтверждения
                    покупателями ({stats?.heldSatsCount}).
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BtcPayout />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Payout Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Вывод средств</CardTitle>
            <CardDescription>
              Выведите заработанные средства на банковскую карту
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-secondary/50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground">Доступно для вывода:</span>
                <span className="text-2xl font-bold text-green-600">
                  {formatPrice(stats?.balance || 0)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Минимальная сумма для вывода: {(minPayoutAmount / 100).toLocaleString('ru-RU')} ₽
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Средства становятся доступны после того, как покупатель
                подтвердит получение товара
              </p>
            </div>

            <Button 
              className="w-full" 
              size="lg"
              disabled={(stats?.balance || 0) < minPayoutAmount}
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Запросить вывод
            </Button>

            {(stats?.balance || 0) < minPayoutAmount && (
              <p className="text-sm text-center text-muted-foreground">
                Накопите минимум {(minPayoutAmount / 100).toLocaleString('ru-RU')} ₽ для вывода средств
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Commission Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Как работает комиссия</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-xl">
                <div className="text-4xl font-bold text-primary">{commissionRate}%</div>
                <div>
                  <p className="font-medium">Комиссия платформы</p>
                  <p className="text-sm text-muted-foreground">
                    Вычитается автоматически при каждой продаже
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl">
                <div className="text-4xl font-bold text-green-600">{100 - commissionRate}%</div>
                <div>
                  <p className="font-medium">Ваш доход</p>
                  <p className="text-sm text-muted-foreground">
                    Перечисляется после подтверждения сделки покупателем
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
