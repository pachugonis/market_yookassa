"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Shield, Loader2, Copy, Check, AlertTriangle, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

interface TwoFactorSettingsProps {
  twoFactorEnabled: boolean
  onStatusChange?: () => void
}

export default function TwoFactorSettings({ twoFactorEnabled, onStatusChange }: TwoFactorSettingsProps) {
  const { toast } = useToast()
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [isDisableOpen, setIsDisableOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<"qr" | "verify">("qr")
  
  // Setup state
  const [secret, setSecret] = useState("")
  const [qrCode, setQrCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState("")
  const [copiedCodes, setCopiedCodes] = useState(false)
  
  // Disable state
  const [disablePassword, setDisablePassword] = useState("")

  const handleStartSetup = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
      })

      const data = await response.json()

      if (data.success) {
        setSecret(data.data.secret)
        setQrCode(data.data.qrCode)
        setBackupCodes(data.data.backupCodes)
        setIsSetupOpen(true)
        setStep("qr")
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("2FA setup error:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось начать настройку 2FA",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyAndEnable = async () => {
    if (!verificationCode) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите код подтверждения",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: verificationCode,
          secret,
          backupCodes,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успешно!",
          description: "Двухфакторная аутентификация включена",
        })
        setIsSetupOpen(false)
        resetSetupState()
        onStatusChange?.()
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: data.error || "Неверный код",
        })
      }
    } catch (error) {
      console.error("2FA enable error:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось включить 2FA",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisable = async () => {
    if (!disablePassword) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите пароль",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успешно",
          description: "Двухфакторная аутентификация отключена",
        })
        setIsDisableOpen(false)
        setDisablePassword("")
        onStatusChange?.()
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: data.error || "Неверный пароль",
        })
      }
    } catch (error) {
      console.error("2FA disable error:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось отключить 2FA",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyBackupCodes = () => {
    const codesText = backupCodes.join("\n")
    navigator.clipboard.writeText(codesText)
    setCopiedCodes(true)
    toast({
      title: "Скопировано",
      description: "Резервные коды скопированы в буфер обмена",
    })
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  const resetSetupState = () => {
    setSecret("")
    setQrCode("")
    setBackupCodes([])
    setVerificationCode("")
    setStep("qr")
    setCopiedCodes(false)
  }

  const handleCloseSetup = () => {
    setIsSetupOpen(false)
    resetSetupState()
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Двухфакторная аутентификация</CardTitle>
            </div>
            <CardDescription>
              Добавьте дополнительный уровень безопасности для вашего аккаунта
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex-1">
                <p className="font-medium">
                  {twoFactorEnabled ? "2FA включена" : "2FA отключена"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {twoFactorEnabled
                    ? "Ваш аккаунт защищен двухфакторной аутентификацией"
                    : "Защитите свой аккаунт с помощью приложения-аутентификатора"}
                </p>
              </div>
              <Button
                variant={twoFactorEnabled ? "destructive" : "default"}
                onClick={twoFactorEnabled ? () => setIsDisableOpen(true) : handleStartSetup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : twoFactorEnabled ? (
                  "Отключить"
                ) : (
                  "Включить"
                )}
              </Button>
            </div>

            {twoFactorEnabled && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Сохраните резервные коды в безопасном месте. Они понадобятся для входа, если вы потеряете доступ к приложению-аутентификатору.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Setup Dialog */}
      <Dialog open={isSetupOpen} onOpenChange={handleCloseSetup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === "qr" ? "Настройка 2FA" : "Подтверждение"}
            </DialogTitle>
            <DialogDescription>
              {step === "qr"
                ? "Отсканируйте QR-код в приложении-аутентификаторе"
                : "Введите код из приложения для подтверждения"}
            </DialogDescription>
          </DialogHeader>

          {step === "qr" ? (
            <div className="space-y-4">
              {qrCode && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <Image src={qrCode} alt="QR Code" width={200} height={200} />
                </div>
              )}

              <div className="space-y-2">
                <Label>Или введите код вручную:</Label>
                <div className="flex gap-2">
                  <Input value={secret} readOnly className="font-mono text-sm" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(secret)
                      toast({ title: "Скопировано", description: "Секретный ключ скопирован" })
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Резервные коды:</Label>
                <div className="p-3 bg-secondary rounded-lg">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {backupCodes.map((code, idx) => (
                      <div key={idx}>{code}</div>
                    ))}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={copyBackupCodes}
                >
                  {copiedCodes ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Скопировать коды
                    </>
                  )}
                </Button>
              </div>

              <DialogFooter>
                <Button onClick={() => setStep("verify")} className="w-full">
                  Продолжить
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-code">Код подтверждения</Label>
                <Input
                  id="verify-code"
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="text-center text-lg tracking-widest"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <DialogFooter className="flex-col gap-2">
                <Button
                  onClick={handleVerifyAndEnable}
                  disabled={isLoading || !verificationCode}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Проверка...
                    </>
                  ) : (
                    "Подтвердить и включить"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setStep("qr")} className="w-full">
                  Назад
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={isDisableOpen} onOpenChange={setIsDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить 2FA?</AlertDialogTitle>
            <AlertDialogDescription>
              Это сделает ваш аккаунт менее защищенным. Введите пароль для подтверждения.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="disable-password">Пароль</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="disable-password"
                type="password"
                placeholder="Введите пароль"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDisablePassword("")}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable}
              disabled={isLoading || !disablePassword}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Отключение...
                </>
              ) : (
                "Отключить 2FA"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
