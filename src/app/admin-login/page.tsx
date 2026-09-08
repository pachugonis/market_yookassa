"use client"

import { useState } from "react"
import { signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Loader2 } from "lucide-react"
import { motion } from "framer-motion"

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Неверный email или пароль",
  email_not_verified: "Пожалуйста, подтвердите ваш email перед входом",
  rate_limited: "Слишком много попыток входа. Попробуйте через несколько минут.",
  "2fa_invalid": "Неверный код подтверждения",
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [twoFactorToken, setTwoFactorToken] = useState("")
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [step, setStep] = useState<"credentials" | "2fa">("credentials")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        twoFactorToken: step === "2fa" ? twoFactorToken : "",
        isBackupCode: step === "2fa" && useBackupCode ? "true" : "false",
        redirect: false,
      })

      if (result?.code === "2fa_required") {
        setStep("2fa")
        setTwoFactorToken("")
        return
      }

      if (!result?.ok || result.error) {
        setError(ERROR_MESSAGES[result?.code ?? ""] ?? "Неверный email или пароль")
        if (result?.code === "invalid_credentials") {
          setStep("credentials")
          setTwoFactorToken("")
        }
        return
      }

      // Verify that the user is actually an admin
      const response = await fetch("/api/auth/session")
      const session = await response.json()

      if (session?.user?.role === "ADMIN") {
        router.push("/admin")
        router.refresh()
      } else {
        setError("Доступ запрещён. Только для администраторов.")
        // Завершаем сессию штатным способом (с CSRF-токеном)
        await signOut({ redirect: false })
        setStep("credentials")
        setTwoFactorToken("")
      }
    } catch {
      setError("Произошла ошибка при входе")
    } finally {
      setIsLoading(false)
    }
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
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-primary">
            <div className="bg-primary/10 p-3 rounded-full">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mt-4">Вход для администратора</h1>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Панель управления</CardTitle>
            <CardDescription>
              Введите учётные данные администратора
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

              {step === "credentials" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email администратора</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Пароль</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="twoFactorToken">
                    {useBackupCode ? "Резервный код" : "Код подтверждения"}
                  </Label>
                  <Input
                    id="twoFactorToken"
                    type="text"
                    inputMode={useBackupCode ? "text" : "numeric"}
                    autoComplete="one-time-code"
                    placeholder={useBackupCode ? "XXXXXXXX" : "000000"}
                    value={twoFactorToken}
                    onChange={(e) => setTwoFactorToken(e.target.value)}
                    required
                    autoFocus
                    disabled={isLoading}
                    className="h-11 tracking-widest"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {step === "2fa" ? "Проверка..." : "Вход..."}
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    {step === "2fa" ? "Подтвердить" : "Войти в панель"}
                  </>
                )}
              </Button>
            </form>

            {step === "2fa" && (
              <div className="mt-4 text-center text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode)
                    setTwoFactorToken("")
                    setError("")
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  {useBackupCode
                    ? "Использовать код из приложения"
                    : "Использовать резервный код"}
                </button>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>⚠️ Только для администраторов системы</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
