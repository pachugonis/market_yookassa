"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { Shield, Loader2, ShoppingBag, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

function Verify2FAContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const email = searchParams.get("email")

  useEffect(() => {
    if (!email) {
      router.push("/login")
    }
  }, [email, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // First verify the 2FA code
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token: token.replace(/\s/g, ""),
          isBackupCode: useBackupCode,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Now sign in with the stored credentials
        const pendingEmail = sessionStorage.getItem("2fa_pending_email")
        const pendingPassword = sessionStorage.getItem("2fa_pending_password")
        
        if (pendingEmail && pendingPassword) {
          const signInResult = await signIn("credentials", {
            email: pendingEmail,
            password: pendingPassword,
            redirect: false,
          })

          // Clear stored credentials
          sessionStorage.removeItem("2fa_pending_email")
          sessionStorage.removeItem("2fa_pending_password")

          if (signInResult?.error) {
            setError("Ошибка входа. Попробуйте снова.")
          } else {
            toast({
              title: "Успешно!",
              description: "Вход выполнен успешно",
            })
            router.push("/")
            router.refresh()
          }
        } else {
          setError("Сессия истекла. Пожалуйста, войдите снова.")
        }
      } else {
        setError(data.error || "Неверный код")
      }
    } catch {
      setError("Произошла ошибка при проверке")
    } finally {
      setIsLoading(false)
    }
  }

  if (!email) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-primary">
            <ShoppingBag className="h-8 w-8" />
            Amazonus
          </Link>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              {useBackupCode ? "Резервный код" : "Двухфакторная аутентификация"}
            </CardTitle>
            <CardDescription>
              {useBackupCode
                ? "Введите один из ваших резервных кодов"
                : "Введите код из приложения-аутентификатора"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 rounded-xl bg-red-50 text-red-600 text-sm text-center"
                >
                  {error}
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="token">
                  {useBackupCode ? "Резервный код" : "Код подтверждения"}
                </Label>
                <Input
                  id="token"
                  type="text"
                  placeholder={useBackupCode ? "XXXXXXXX" : "000000"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="text-center text-lg tracking-widest"
                  maxLength={useBackupCode ? 8 : 6}
                  required
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  "Подтвердить"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode)
                    setToken("")
                    setError("")
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  {useBackupCode
                    ? "Использовать код из приложения"
                    : "Использовать резервный код"}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Вернуться к входу
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    }>
      <Verify2FAContent />
    </Suspense>
  )
}
