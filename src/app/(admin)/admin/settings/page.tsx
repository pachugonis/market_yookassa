"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { 
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Mail,
  Percent,
  DollarSign,
  Shield,
  Bell,
  Send,
  Construction,
  Store
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo"

export default function SettingsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  // Platform settings
  const [platformSettings, setPlatformSettings] = useState({
    siteName: SITE_NAME,
    siteDescription: SITE_DESCRIPTION,
    supportEmail: "support@amazonus.ru",
    commissionRate: 10,
    minProductPrice: 1,
    maxProductPrice: 1000000,
    maxFileSize: 500,
    minPayoutAmount: 1000,
    btcMinPayoutSats: 50000,
    btcPayoutFeeMinSats: 500,
    btcPayoutFeeMaxSats: 30000,
    btcPayoutFeeBlockTarget: 6,
    btcPayoutTxVsize: 200,
    btcPayoutQuoteMinutes: 15,
  })

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings")
      const data = await response.json()

      if (data.success && data.data) {
        setPlatformSettings(prev => ({
          ...prev,
          siteName: data.data.siteName || SITE_NAME,
          siteDescription: data.data.siteDescription || SITE_DESCRIPTION,
          supportEmail: data.data.supportEmail || "support@amazonus.ru",
          commissionRate: data.data.commissionRate,
          minPayoutAmount: (data.data.minPayoutAmount || 100000) / 100,
          maxFileSize: data.data.maxFileSize || 500,
          btcMinPayoutSats: data.data.btcMinPayoutSats ?? 50000,
          btcPayoutFeeMinSats: data.data.btcPayoutFeeMinSats ?? 500,
          btcPayoutFeeMaxSats: data.data.btcPayoutFeeMaxSats ?? 30000,
          btcPayoutFeeBlockTarget: data.data.btcPayoutFeeBlockTarget ?? 6,
          btcPayoutTxVsize: data.data.btcPayoutTxVsize ?? 200,
          btcPayoutQuoteMinutes: data.data.btcPayoutQuoteMinutes ?? 15,
        }))
        setEmailSettings({
          smtpHost: data.data.smtpHost || "",
          smtpPort: data.data.smtpPort || 587,
          smtpUser: data.data.smtpUser || "",
          smtpPassword: data.data.smtpPassword || "",
          fromEmail: data.data.fromEmail || "noreply@digimarket.com",
          fromName: data.data.fromName || "DigiMarket",
        })
        setNotifications({
          notifyNewUser: data.data.notifyNewUser ?? true,
          notifyNewProduct: data.data.notifyNewProduct ?? true,
          notifyNewPurchase: data.data.notifyNewPurchase ?? true,
          notifyPayoutRequest: data.data.notifyPayoutRequest ?? true,
          notifyReportSubmission: data.data.notifyReportSubmission ?? false,
        })
        setSecuritySettings({
          requireEmailVerification: data.data.requireEmailVerification ?? false,
          enableTwoFactor: data.data.enableTwoFactor ?? false,
          sessionTimeout: data.data.sessionTimeout ?? 24,
          maxLoginAttempts: data.data.maxLoginAttempts ?? 5,
        })
        setSingleVendorMode(data.data.singleVendorMode ?? false)
        setStoresPageEnabled(data.data.storesPageEnabled ?? true)
        setMaintenanceSettings({
          maintenanceMode: data.data.maintenanceMode ?? false,
          maintenanceMessage: data.data.maintenanceMessage ?? "Сайт временно недоступен. Ведутся технические работы.",
        })
      }
    } catch (error) {
      console.error("Error loading settings:", error)
    } finally {
      setIsLoadingSettings(false)
    }
  }

  // Email settings
  const [emailSettings, setEmailSettings] = useState({
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    fromEmail: "noreply@digimarket.com",
    fromName: "DigiMarket",
  })

  // Notification settings
  const [notifications, setNotifications] = useState({
    notifyNewUser: true,
    notifyNewProduct: true,
    notifyNewPurchase: true,
    notifyPayoutRequest: true,
    notifyReportSubmission: false,
  })

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    requireEmailVerification: false,
    enableTwoFactor: false,
    sessionTimeout: 24,
    maxLoginAttempts: 5,
  })

  // Maintenance settings
  const [maintenanceSettings, setMaintenanceSettings] = useState({
    maintenanceMode: false,
    maintenanceMessage: "Сайт временно недоступен. Ведутся технические работы.",
  })

  // Режим одного продавца
  const [singleVendorMode, setSingleVendorMode] = useState(false)

  const handleSaveSingleVendorMode = async (enabled: boolean) => {
    setIsLoading(true)
    // Показываем новое положение сразу: переключатель без отклика
    // выглядит сломанным. При ошибке вернём как было.
    setSingleVendorMode(enabled)

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ singleVendorMode: enabled }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: enabled
            ? "Режим одного продавца включён"
            : "Режим одного продавца выключен",
        })
      } else {
        setSingleVendorMode(!enabled)
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось сохранить настройки",
          variant: "destructive",
        })
      }
    } catch {
      setSingleVendorMode(!enabled)
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Витрина продавцов
  const [storesPageEnabled, setStoresPageEnabled] = useState(true)

  const handleSaveStoresPageEnabled = async (enabled: boolean) => {
    setIsLoading(true)
    // Как и у режима одного продавца: положение переключателя меняем
    // сразу, при ошибке возвращаем обратно.
    setStoresPageEnabled(enabled)

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storesPageEnabled: enabled }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: enabled
            ? "Страница «Магазины» включена"
            : "Страница «Магазины» выключена",
        })
      } else {
        setStoresPageEnabled(!enabled)
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось сохранить настройки",
          variant: "destructive",
        })
      }
    } catch {
      setStoresPageEnabled(!enabled)
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSavePlatformSettings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: platformSettings.siteName,
          siteDescription: platformSettings.siteDescription,
          supportEmail: platformSettings.supportEmail,
          commissionRate: platformSettings.commissionRate,
          minPayoutAmount: platformSettings.minPayoutAmount * 100,
          maxFileSize: platformSettings.maxFileSize,
          btcMinPayoutSats: platformSettings.btcMinPayoutSats,
          btcPayoutFeeMinSats: platformSettings.btcPayoutFeeMinSats,
          btcPayoutFeeMaxSats: platformSettings.btcPayoutFeeMaxSats,
          btcPayoutFeeBlockTarget: platformSettings.btcPayoutFeeBlockTarget,
          btcPayoutTxVsize: platformSettings.btcPayoutTxVsize,
          btcPayoutQuoteMinutes: platformSettings.btcPayoutQuoteMinutes,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: "Настройки платформы сохранены",
        })
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось сохранить настройки",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveEmailSettings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: emailSettings.smtpHost,
          smtpPort: emailSettings.smtpPort,
          smtpUser: emailSettings.smtpUser,
          smtpPassword: emailSettings.smtpPassword,
          fromEmail: emailSettings.fromEmail,
          fromName: emailSettings.fromName,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: "Настройки email сохранены",
        })
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось сохранить настройки email",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки email",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestEmail = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailSettings),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: "Тестовое письмо отправлено!",
        })
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось отправить тестовое письмо",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить тестовое письмо",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveNotifications = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifications),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: "Настройки уведомлений сохранены",
        })
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось сохранить настройки уведомлений",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки уведомлений",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSecuritySettings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(securitySettings),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: "Настройки безопасности сохранены",
        })
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось сохранить настройки безопасности",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки безопасности",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveMaintenanceSettings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maintenanceSettings),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Успех",
          description: maintenanceSettings.maintenanceMode 
            ? "Режим технических работ включён" 
            : "Режим технических работ выключён",
        })
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось сохранить настройки",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Настройки</h1>
        <p className="text-muted-foreground mt-2">Управление настройками платформы</p>
      </div>

      {/* Platform Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Основные настройки</h2>
        </div>
        
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">Название сайта</Label>
              <Input
                id="siteName"
                value={platformSettings.siteName}
                onChange={(e) => setPlatformSettings({ ...platformSettings, siteName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supportEmail">Email поддержки</Label>
              <Input
                id="supportEmail"
                type="email"
                value={platformSettings.supportEmail}
                onChange={(e) => setPlatformSettings({ ...platformSettings, supportEmail: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="siteDescription">Описание сайта</Label>
            <Textarea
              id="siteDescription"
              value={platformSettings.siteDescription}
              onChange={(e) => setPlatformSettings({ ...platformSettings, siteDescription: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commissionRate">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Комиссия платформы (%)
                </div>
              </Label>
              <Input
                id="commissionRate"
                type="number"
                min="0"
                max="100"
                value={platformSettings.commissionRate}
                onChange={(e) => setPlatformSettings({ ...platformSettings, commissionRate: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minPrice">Мин. цена товара (₽)</Label>
              <Input
                id="minPrice"
                type="number"
                min="1"
                value={platformSettings.minProductPrice}
                onChange={(e) => setPlatformSettings({ ...platformSettings, minProductPrice: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPrice">Макс. цена товара (₽)</Label>
              <Input
                id="maxPrice"
                type="number"
                min="1"
                value={platformSettings.maxProductPrice}
                onChange={(e) => setPlatformSettings({ ...platformSettings, maxProductPrice: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxFileSize">Макс. размер файла (МБ)</Label>
            <Input
              id="maxFileSize"
              type="number"
              min="1"
              max="5000"
              value={platformSettings.maxFileSize}
              onChange={(e) => setPlatformSettings({ ...platformSettings, maxFileSize: Number(e.target.value) })}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Максимальный размер файла для загрузки продавцами</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minPayoutAmount">Минимальная сумма вывода (₽)</Label>
            <Input
              id="minPayoutAmount"
              type="number"
              min="1"
              value={platformSettings.minPayoutAmount}
              onChange={(e) => setPlatformSettings({ ...platformSettings, minPayoutAmount: Number(e.target.value) })}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Минимальная сумма для вывода средств продавцами (например, 1000 = 1000₽)</p>
          </div>

          {/*
            Вывод биткоина. Комиссия сети считается как «оценка сети ×
            расчётный размер транзакции» и зажимается между границами:
            всплеск в мемпуле не сделает вывод разорительным, а провал
            ставки не оставит площадку в убытке.
          */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="btcMinPayoutSats">Минимальный вывод BTC (сатоши)</Label>
              <Input
                id="btcMinPayoutSats"
                type="number"
                min="546"
                value={platformSettings.btcMinPayoutSats}
                onChange={(e) => setPlatformSettings({ ...platformSettings, btcMinPayoutSats: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">Сколько продавец должен получить на руки, чтобы вывод имел смысл</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="btcPayoutFeeBlockTarget">Целевое число блоков</Label>
              <Input
                id="btcPayoutFeeBlockTarget"
                type="number"
                min="1"
                max="144"
                value={platformSettings.btcPayoutFeeBlockTarget}
                onChange={(e) => setPlatformSettings({ ...platformSettings, btcPayoutFeeBlockTarget: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">За сколько блоков транзакция должна попасть в цепочку: меньше — быстрее и дороже</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="btcPayoutFeeMinSats">Комиссия за вывод, минимум (сатоши)</Label>
              <Input
                id="btcPayoutFeeMinSats"
                type="number"
                min="0"
                value={platformSettings.btcPayoutFeeMinSats}
                onChange={(e) => setPlatformSettings({ ...platformSettings, btcPayoutFeeMinSats: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="btcPayoutFeeMaxSats">Комиссия за вывод, максимум (сатоши)</Label>
              <Input
                id="btcPayoutFeeMaxSats"
                type="number"
                min="0"
                value={platformSettings.btcPayoutFeeMaxSats}
                onChange={(e) => setPlatformSettings({ ...platformSettings, btcPayoutFeeMaxSats: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="btcPayoutTxVsize">Расчётный размер транзакции (vB)</Label>
              <Input
                id="btcPayoutTxVsize"
                type="number"
                min="100"
                max="2000"
                value={platformSettings.btcPayoutTxVsize}
                onChange={(e) => setPlatformSettings({ ...platformSettings, btcPayoutTxVsize: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">Точный размер известен только при подписи; типовая транзакция — около 200 vB</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="btcPayoutQuoteMinutes">Срок действия котировки (мин)</Label>
              <Input
                id="btcPayoutQuoteMinutes"
                type="number"
                min="1"
                max="120"
                value={platformSettings.btcPayoutQuoteMinutes}
                onChange={(e) => setPlatformSettings({ ...platformSettings, btcPayoutQuoteMinutes: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSavePlatformSettings} disabled={isLoading}>
              {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Сохранить
            </Button>
          </div>
        </div>
      </Card>

      {/* Email Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Настройки Email</h2>
        </div>
        
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                value={emailSettings.smtpHost}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                placeholder="smtp.gmail.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtpPort">SMTP Port</Label>
              <Input
                id="smtpPort"
                type="number"
                value={emailSettings.smtpPort}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpUser">SMTP User</Label>
              <Input
                id="smtpUser"
                value={emailSettings.smtpUser}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                placeholder="your-email@gmail.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtpPassword">SMTP Password</Label>
              <Input
                id="smtpPassword"
                type="password"
                value={emailSettings.smtpPassword}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromEmail">Отправитель Email</Label>
              <Input
                id="fromEmail"
                type="email"
                value={emailSettings.fromEmail}
                onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fromName">Имя отправителя</Label>
              <Input
                id="fromName"
                value={emailSettings.fromName}
                onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleTestEmail}
              disabled={isLoading || !emailSettings.smtpHost || !emailSettings.smtpUser}
            >
              {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Тестировать
            </Button>
            <Button onClick={handleSaveEmailSettings} disabled={isLoading}>
              {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Сохранить
            </Button>
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Уведомления администраторов</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium">Регистрация нового пользователя</p>
              <p className="text-sm text-muted-foreground">Получать уведомления при регистрации</p>
            </div>
            <Switch
              checked={notifications.notifyNewUser}
              onCheckedChange={(checked: boolean) => setNotifications({ ...notifications, notifyNewUser: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium">Новый товар</p>
              <p className="text-sm text-muted-foreground">Уведомлять о загрузке новых товаров</p>
            </div>
            <Switch
              checked={notifications.notifyNewProduct}
              onCheckedChange={(checked: boolean) => setNotifications({ ...notifications, notifyNewProduct: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium">Новая покупка</p>
              <p className="text-sm text-muted-foreground">Уведомлять о каждой покупке</p>
            </div>
            <Switch
              checked={notifications.notifyNewPurchase}
              onCheckedChange={(checked: boolean) => setNotifications({ ...notifications, notifyNewPurchase: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium">Запрос на выплату</p>
              <p className="text-sm text-muted-foreground">Уведомлять о запросах продавцов на выплату</p>
            </div>
            <Switch
              checked={notifications.notifyPayoutRequest}
              onCheckedChange={(checked: boolean) => setNotifications({ ...notifications, notifyPayoutRequest: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Жалобы и репорты</p>
              <p className="text-sm text-muted-foreground">Уведомлять о жалобах пользователей</p>
            </div>
            <Switch
              checked={notifications.notifyReportSubmission}
              onCheckedChange={(checked: boolean) => setNotifications({ ...notifications, notifyReportSubmission: checked })}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveNotifications} disabled={isLoading}>
              {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Сохранить
            </Button>
          </div>
        </div>
      </Card>

      {/* Security Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Безопасность</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium">Подтверждение email</p>
              <p className="text-sm text-muted-foreground">Требовать подтверждение email при регистрации</p>
            </div>
            <Switch
              checked={securitySettings.requireEmailVerification}
              onCheckedChange={(checked: boolean) => setSecuritySettings({ ...securitySettings, requireEmailVerification: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium">Двухфакторная аутентификация</p>
              <p className="text-sm text-muted-foreground">Включить 2FA для всех пользователей</p>
            </div>
            <Switch
              checked={securitySettings.enableTwoFactor}
              onCheckedChange={(checked: boolean) => setSecuritySettings({ ...securitySettings, enableTwoFactor: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionTimeout">Таймаут сессии (часы)</Label>
            <Input
              id="sessionTimeout"
              type="number"
              min="1"
              max="168"
              value={securitySettings.sessionTimeout}
              onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: Number(e.target.value) })}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Через сколько часов пользователь будет автоматически выходить</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxLoginAttempts">Макс. попыток входа</Label>
            <Input
              id="maxLoginAttempts"
              type="number"
              min="3"
              max="10"
              value={securitySettings.maxLoginAttempts}
              onChange={(e) => setSecuritySettings({ ...securitySettings, maxLoginAttempts: Number(e.target.value) })}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Количество неудачных попыток входа до блокировки</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveSecuritySettings} disabled={isLoading}>
              {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Сохранить
            </Button>
          </div>
        </div>
      </Card>

      {/* Single Vendor Mode */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Store className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Режим одного продавца</h2>
        </div>

        <div className="space-y-4">
          <div className="bg-secondary/40 p-4 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground mb-2">
              Площадка работает как магазин одного лица. При включении:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>регистрация продавцов закрыта — новые аккаунты только покупатели;</li>
              <li>товары выставляет и правит только администратор;</li>
              <li>
                сплитования нет: вся сумма сделки приходит на счёт площадки,
                реквизиты продавцов у платёжных сервисов не используются.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Уже заведённые продавцы кабинет не теряют: там остаётся история
              продаж и остаток на балансе, который они смогут вывести. Роль
              продавца при необходимости выдаётся вручную в разделе
              «Пользователи».
            </p>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Включить режим одного продавца</p>
              <p className="text-sm text-muted-foreground">
                {singleVendorMode
                  ? "Товары выставляет только администратор, платежи идут одному получателю"
                  : "Площадка открыта для сторонних продавцов"}
              </p>
            </div>
            <Switch
              checked={singleVendorMode}
              disabled={isLoading}
              onCheckedChange={handleSaveSingleVendorMode}
            />
          </div>
        </div>
      </Card>

      {/* Stores Page */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Store className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Витрина продавцов</h2>
        </div>

        <div className="space-y-4">
          <div className="bg-secondary/40 p-4 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              Страница <code className="bg-background px-2 py-1 rounded">/stores</code> со
              списком магазинов. При выключении страница отдаёт 404, пункт
              «Магазины» пропадает из верхнего меню, а адрес — из sitemap.
              Товары продавцов остаются в каталоге и открываются как обычно.
            </p>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Показывать страницу «Магазины»</p>
              <p className="text-sm text-muted-foreground">
                {storesPageEnabled
                  ? "Витрина продавцов открыта, ссылка есть в меню"
                  : "Витрина продавцов скрыта, ссылки в меню нет"}
              </p>
            </div>
            <Switch
              checked={storesPageEnabled}
              disabled={isLoading}
              onCheckedChange={handleSaveStoresPageEnabled}
            />
          </div>
        </div>
      </Card>

      {/* Maintenance Mode Settings */}
      <Card className="p-6 border-2 border-warning/50">
        <div className="flex items-center gap-2 mb-6">
          <Construction className="h-5 w-5 text-warning" />
          <h2 className="text-xl font-semibold">Режим технических работ</h2>
        </div>
        
        <div className="space-y-4">
          <div className="bg-warning/10 p-4 rounded-lg border border-warning/20">
            <p className="text-sm text-muted-foreground mb-2">
              При включении этого режима все пользователи (кроме администраторов) будут перенаправлены на страницу технических работ. 
              Вы сохраните доступ к сайту для управления и настройки.
            </p>
            <p className="text-sm font-medium text-warning mt-3">
              🔐 Адрес для входа администратора: <code className="bg-background px-2 py-1 rounded">/admin-login</code>
            </p>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium">Включить режим технических работ</p>
              <p className="text-sm text-muted-foreground">
                {maintenanceSettings.maintenanceMode 
                  ? "Сайт сейчас в режиме технических работ" 
                  : "Сайт доступен для всех пользователей"}
              </p>
            </div>
            <Switch
              checked={maintenanceSettings.maintenanceMode}
              onCheckedChange={(checked: boolean) => setMaintenanceSettings({ ...maintenanceSettings, maintenanceMode: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenanceMessage">Сообщение для пользователей</Label>
            <Textarea
              id="maintenanceMessage"
              value={maintenanceSettings.maintenanceMessage}
              onChange={(e) => setMaintenanceSettings({ ...maintenanceSettings, maintenanceMessage: e.target.value })}
              rows={3}
              placeholder="Сайт временно недоступен. Ведутся технические работы."
            />
            <p className="text-xs text-muted-foreground">Это сообщение будет показано посетителям сайта</p>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSaveMaintenanceSettings} 
              disabled={isLoading}
              variant={maintenanceSettings.maintenanceMode ? "destructive" : "default"}
            >
              {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Сохранить
            </Button>
          </div>
        </div>
      </Card>

      {/* Payment Settings Info */}
      <Card className="p-6 bg-secondary/20">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Настройки платежей</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Платёжные сервисы настраиваются переменными окружения в файле .env.
          Достаточно одного, но можно подключить оба — покупатель выберет способ
          оплаты сам:
        </p>
        <div className="bg-card p-4 rounded-lg font-mono text-sm space-y-2">
          <div>YOOKASSA_SHOP_ID=your_shop_id</div>
          <div>YOOKASSA_SECRET_KEY=your_secret_key</div>
          <div>CLOUDPAYMENTS_PUBLIC_ID=pk_xxxxxxxx</div>
          <div>CLOUDPAYMENTS_API_SECRET=your_api_secret</div>
          <div>CLOUDPAYMENTS_PAYOUT_PUBLIC_ID=pk_xxxxxxxx</div>
          <div>CLOUDPAYMENTS_PAYOUT_API_SECRET=your_payout_api_secret</div>
          <div>PAYMENT_PROVIDER_DEFAULT=YOOKASSA</div>
          <div>NEXT_PUBLIC_BASE_URL=http://localhost:3000</div>
        </div>
      </Card>
    </div>
  )
}
