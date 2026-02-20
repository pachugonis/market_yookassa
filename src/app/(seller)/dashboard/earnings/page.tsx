"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Wallet, TrendingUp, Percent, Loader2, CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"

interface Stats {
  balance: number
  totalEarnings: number
  totalSales: number
  commissionRate?: number
}

export default function EarningsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [commissionRate, setCommissionRate] = useState(10)

  useEffect(() => {
    fetchStats()
    fetchCommissionRate()
  }, [])

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
                Минимальная сумма для вывода: 1 000 руб.
              </p>
            </div>

            <Button 
              className="w-full" 
              size="lg"
              disabled={(stats?.balance || 0) < 1000}
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Запросить вывод
            </Button>

            {(stats?.balance || 0) < 1000 && (
              <p className="text-sm text-center text-muted-foreground">
                Накопите минимум 1 000 руб. для вывода средств
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
                    Зачисляется на ваш баланс сразу после оплаты
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
