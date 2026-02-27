"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react"
import Link from "next/link"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const token = searchParams.get("token")

    if (!token) {
      setStatus("error")
      setMessage("Токен верификации не найден")
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`)
        const data = await response.json()

        if (data.success) {
          setStatus("success")
          setMessage(data.message || "Email успешно подтвержден!")
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push("/login?verified=true")
          }, 3000)
        } else {
          setStatus("error")
          setMessage(data.error || "Ошибка при подтверждении email")
        }
      } catch (error) {
        setStatus("error")
        setMessage("Произошла ошибка при подтверждении email")
      }
    }

    verifyEmail()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-2xl p-8">
          <div className="text-center space-y-4">
            {status === "loading" && (
              <>
                <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
                <h2 className="text-2xl font-bold">Подтверждение email...</h2>
                <p className="text-muted-foreground">
                  Пожалуйста, подождите
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                <h2 className="text-2xl font-bold text-green-600">Успешно!</h2>
                <p className="text-muted-foreground">{message}</p>
                <p className="text-sm text-muted-foreground">
                  Вы будете перенаправлены на страницу входа...
                </p>
              </>
            )}

            {status === "error" && (
              <>
                <XCircle className="h-16 w-16 mx-auto text-red-500" />
                <h2 className="text-2xl font-bold text-red-600">Ошибка</h2>
                <p className="text-muted-foreground">{message}</p>
                <div className="flex flex-col gap-2 mt-4">
                  <Link href="/login">
                    <Button className="w-full">
                      Перейти на страницу входа
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="outline" className="w-full">
                      Зарегистрироваться заново
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
