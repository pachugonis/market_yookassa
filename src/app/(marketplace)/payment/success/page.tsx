"use client"

import { Suspense } from "react"
import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { CheckCircle, XCircle, Loader2, Download, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const purchaseId = searchParams.get("purchaseId")
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading")
  const [product, setProduct] = useState<{ title: string; coverImage: string | null } | null>(null)

  useEffect(() => {
    if (!purchaseId) {
      router.push("/")
      return
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/payments/status?purchaseId=${purchaseId}`)
        const data = await res.json()

        if (data.success) {
          setProduct(data.data.product)
          if (data.data.status === "COMPLETED") {
            setStatus("success")
          } else if (data.data.status === "FAILED") {
            setStatus("failed")
          } else {
            // Still pending, check again in 2 seconds
            setTimeout(checkStatus, 2000)
          }
        }
      } catch (error) {
        console.error("Error checking status:", error)
        setStatus("failed")
      }
    }

    checkStatus()
  }, [purchaseId, router])

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8 text-center">
              {status === "loading" && (
                <>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                  <h1 className="text-2xl font-bold mb-2">Обработка платежа</h1>
                  <p className="text-muted-foreground">
                    Пожалуйста, подождите...
                  </p>
                </>
              )}

              {status === "success" && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6"
                  >
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </motion.div>
                  <h1 className="text-2xl font-bold mb-2">Оплата прошла успешно!</h1>
                  <p className="text-muted-foreground mb-6">
                    {product?.title && `Товар "${product.title}" добавлен в вашу библиотеку.`}
                  </p>
                  <div className="space-y-3">
                    <Link href="/library">
                      <Button className="w-full" size="lg">
                        <Download className="h-5 w-5 mr-2" />
                        Перейти к загрузке
                      </Button>
                    </Link>
                    <Link href="/products">
                      <Button variant="outline" className="w-full">
                        Продолжить покупки
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </>
              )}

              {status === "failed" && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6"
                  >
                    <XCircle className="h-8 w-8 text-red-600" />
                  </motion.div>
                  <h1 className="text-2xl font-bold mb-2">Ошибка оплаты</h1>
                  <p className="text-muted-foreground mb-6">
                    К сожалению, платеж не был обработан. Попробуйте снова.
                  </p>
                  <div className="space-y-3">
                    <Link href="/products">
                      <Button className="w-full" size="lg">
                        Вернуться в каталог
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Загрузка...</h1>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}
