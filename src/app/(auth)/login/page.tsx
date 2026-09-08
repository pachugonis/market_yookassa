"use client"

import { useState, useEffect, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Mail, Lock, Loader2, ShoppingBag, CheckCircle, Shield, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Неверный email или пароль",
  email_not_verified: "Пожалуйста, подтвердите ваш email перед входом",
  rate_limited: "Слишком много попыток входа. Попробуйте через несколько минут.",
  "2fa_invalid": "Неверный код подтверждения",
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [twoFactorToken, setTwoFactorToken] = useState("")
  const [useBackupCode, setUseBackupCode] = useState(false)
  // "credentials" — email + пароль, "2fa" — запрошен второй фактор
  const [step, setStep] = useState<"credentials" | "2fa">("credentials")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      if (searchParams.get("verification") === "required") {
        setSuccess("Регистрация успешна! Проверьте вашу почту для подтверждения email.")
      } else {
        setSuccess("Регистрация успешна! Теперь вы можете войти.")
      }
    }
    if (searchParams.get("verified") === "true") {
      setSuccess("Email подтвержден! Теперь вы можете войти.")
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Пароль и одноразовый код уходят одним запросом: сессию
      // выдаёт только сервер и только когда сошлось и то, и другое.
      const result = await signIn("credentials", {
        email,
        password,
        twoFactorToken: step === "2fa" ? twoFactorToken : "",
        isBackupCode: step === "2fa" && useBackupCode ? "true" : "false",
        redirect: false,
      })

      if (result?.ok && !result.error) {
        router.push("/")
        router.refresh()
        return
      }

      if (result?.code === "2fa_required") {
        setStep("2fa")
        setTwoFactorToken("")
        return
      }

      setError(ERROR_MESSAGES[result?.code ?? ""] ?? "Неверный email или пароль")

      // Неверный пароль — возвращаем пользователя на первый шаг
      if (result?.code === "invalid_credentials") {
        setStep("credentials")
        setTwoFactorToken("")
      }
    } catch {
      setError("Произошла ошибка при входе")
    } finally {
      setIsLoading(false)
    }
  }

  const backToCredentials = () => {
    setStep("credentials")
    setTwoFactorToken("")
    setUseBackupCode(false)
    setError("")
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
            <CardTitle className="text-2xl font-bold">
              {step === "2fa" ? "Двухфакторная аутентификация" : "Вход в аккаунт"}
            </CardTitle>
            <CardDescription>
              {step === "2fa"
                ? useBackupCode
                  ? "Введите один из резервных кодов"
                  : "Введите код из приложения-аутентификатора"
                : "Введите ваши данные для входа"}
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

              {success && step === "credentials" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 rounded-xl bg-green-50 text-green-600 text-sm text-center flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {success}
                </motion.div>
              )}

              {step === "credentials" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="example@mail.ru"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Пароль</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Введите пароль"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="twoFactorToken">
                    {useBackupCode ? "Резервный код" : "Код подтверждения"}
                  </Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="twoFactorToken"
                      type="text"
                      inputMode={useBackupCode ? "text" : "numeric"}
                      autoComplete="one-time-code"
                      placeholder={useBackupCode ? "XXXXXXXX" : "000000"}
                      value={twoFactorToken}
                      onChange={(e) => setTwoFactorToken(e.target.value)}
                      className="pl-10 tracking-widest"
                      autoFocus
                      required
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {step === "2fa" ? "Проверка..." : "Вход..."}
                  </>
                ) : step === "2fa" ? (
                  "Подтвердить"
                ) : (
                  "Войти"
                )}
              </Button>
            </form>

            {step === "2fa" ? (
              <div className="mt-6 space-y-3 text-center text-sm">
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
                <div>
                  <button
                    type="button"
                    onClick={backToCredentials}
                    className="text-muted-foreground hover:underline inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Вернуться ко входу
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">Нет аккаунта? </span>
                <Link href="/register" className="text-primary font-medium hover:underline">
                  Зарегистрироваться
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
