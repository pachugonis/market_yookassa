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
  Bell
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  // Platform settings
  const [platformSettings, setPlatformSettings] = useState({
    siteName: "DigiMarket",
    siteDescription: "Маркетплейс цифровых товаров",
    supportEmail: "support@digimarket.com",
    commissionRate: 10,
    minProductPrice: 1,
    maxProductPrice: 1000000,
    maxFileSize: 500,
    minPayoutAmount: 1000,
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
          commissionRate: data.data.commissionRate,
          minPayoutAmount: (data.data.minPayoutAmount || 100000) / 100,
        }))
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
    newUserRegistration: true,
    newProductSubmission: true,
    newPurchase: true,
    payoutRequest: true,
    reportSubmission: false,
  })

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    requireEmailVerification: false,
    enableTwoFactor: false,
    sessionTimeout: 24,
    maxLoginAttempts: 5,
  })

  const handleSavePlatformSettings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionRate: platformSettings.commissionRate,
          minPayoutAmount: platformSettings.minPayoutAmount * 100,
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
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast({
        title: "Успех",
        description: "Настройки email сохранены",
      })
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

  const handleSaveNotifications = async () => {
    setIsLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast({
        title: "Успех",
        description: "Настройки уведомлений сохранены",
      })
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
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast({
        title: "Успех",
        description: "Настройки безопасности сохранены",
      })
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
            <p className="text-xs text-muted-foreground">Минимальная сумма для вывода средств продавцами</p>
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

          <div className="flex justify-end">
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
              checked={notifications.newUserRegistration}
              onCheckedChange={(checked: boolean) => setNotifications({ ...notifications, newUserRegistration: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium">Новый товар</p>
              <p className="text-sm text-muted-foreground">Уведомлять о загрузке новых товаров</p>
            </div>
            <Switch
              checked={notifications.newProductSubmission}
              onCheckedChange={(checked: boolean) => setNotifications({ ...notifications, newProductSubmission: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium">Новая покупка</p>
              <p className="text-sm text-muted-foreground">Уведомлять о каждой покупке</p>
            </div>
            <Switch
              checked={notifications.newPurchase}
              onCheckedChange={(checked: boolean) => setNotifications({ ...notifications, newPurchase: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium">Запрос на выплату</p>
              <p className="text-sm text-muted-foreground">Уведомлять о запросах продавцов на выплату</p>
            </div>
            <Switch
              checked={notifications.payoutRequest}
              onCheckedChange={(checked: boolean) => setNotifications({ ...notifications, payoutRequest: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Жалобы и репорты</p>
              <p className="text-sm text-muted-foreground">Уведомлять о жалобах пользователей</p>
            </div>
            <Switch
              checked={notifications.reportSubmission}
              onCheckedChange={(checked: boolean) => setNotifications({ ...notifications, reportSubmission: checked })}
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

      {/* Payment Settings Info */}
      <Card className="p-6 bg-secondary/20">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Настройки платежей</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Для настройки интеграции с YooKassa используйте переменные окружения в файле .env:
        </p>
        <div className="bg-card p-4 rounded-lg font-mono text-sm space-y-2">
          <div>YOOKASSA_SHOP_ID=your_shop_id</div>
          <div>YOOKASSA_SECRET_KEY=your_secret_key</div>
          <div>NEXT_PUBLIC_BASE_URL=http://localhost:3000</div>
        </div>
      </Card>
    </div>
  )
}
