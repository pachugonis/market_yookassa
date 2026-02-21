"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { 
  User, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  Wallet,
  Edit,
  Loader2,
  Save,
  X,
  Camera
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatPrice, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import TwoFactorSettings from "@/components/TwoFactorSettings"
import ChangePassword from "@/components/ChangePassword"
import { ImageCropper } from "@/components/ui/image-cropper"

interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  avatar: string | null
  verified: boolean
  balance: number
  twoFactorEnabled: boolean
  createdAt: string
  _count: {
    purchases: number
    products: number
  }
}

export default function ProfilePage() {
  const { data: session, status: sessionStatus, update } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login")
    }
  }, [sessionStatus, router])

  useEffect(() => {
    if (session) {
      fetchProfile()
    }
  }, [session])

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile")
      const data = await res.json()
      if (data.success) {
        setProfile(data.data)
        setEditedName(data.data.name)
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить профиль",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!editedName.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Имя не может быть пустым",
      })
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editedName }),
      })

      const data = await res.json()

      if (data.success) {
        setProfile(data.data)
        setIsEditing(false)
        // Update session
        await update({ name: editedName })
        toast({
          title: "Успешно",
          description: "Профиль обновлен",
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить профиль",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedName(profile?.name || "")
    setIsEditing(false)
  }

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Недопустимый тип файла. Разрешены только изображения (JPG, PNG, WEBP)",
      })
      return
    }

    // Read file and open cropper
    const reader = new FileReader()
    reader.onload = () => {
      setImageToCrop(reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setUploadingAvatar(true)
    setImageToCrop(null)

    const formData = new FormData()
    formData.append("file", croppedBlob, "avatar.jpg")

    try {
      const uploadRes = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      })

      const uploadData = await uploadRes.json()

      if (uploadData.success) {
        const avatarUrl = uploadData.data.avatarUrl

        // Update profile with new avatar
        const updateRes = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: avatarUrl }),
        })

        const updateData = await updateRes.json()

        if (updateData.success) {
          setProfile(updateData.data)
          // Update session
          await update({ image: avatarUrl })
          toast({
            title: "Успешно",
            description: "Аватар обновлен",
          })
        } else {
          throw new Error(updateData.error)
        }
      } else {
        throw new Error(uploadData.error)
      }
    } catch (error) {
      console.error("Error updating avatar:", error)
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить аватар",
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "Администратор"
      case "SELLER":
        return "Продавец"
      case "BUYER":
        return "Покупатель"
      default:
        return role
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "destructive"
      case "SELLER":
        return "default"
      default:
        return "secondary"
    }
  }

  if (sessionStatus === "loading" || isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Профиль не найден</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
          aspectRatio={1}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Мой профиль</h1>
        <p className="text-muted-foreground">
          Управляйте своей учетной записью
        </p>
      </motion.div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Основная информация</TabsTrigger>
          <TabsTrigger value="security">Безопасность</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6">
        {/* Main Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Основная информация</CardTitle>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Редактировать
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Отмена
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Сохранение...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Сохранить
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar and Name */}
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile.avatar || undefined} />
                    <AvatarFallback className="text-2xl">
                      {profile.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <>
                      <input
                        type="file"
                        id="avatar-upload"
                        className="hidden"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleAvatarFileSelect}
                        disabled={uploadingAvatar}
                      />
                      <label
                        htmlFor="avatar-upload"
                        className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </label>
                    </>
                  )}
                </div>

                <div className="flex-1 w-full">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Label htmlFor="name">Имя</Label>
                      <Input
                        id="name"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Введите имя"
                      />
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-2xl font-bold">{profile.name}</h2>
                      <p className="text-muted-foreground">{profile.email}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Details */}
              <div className="grid gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Роль</p>
                    <Badge variant={getRoleBadgeVariant(profile.role) as any} className="mt-1">
                      {getRoleLabel(profile.role)}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Дата регистрации</p>
                    <p className="font-medium">{formatDate(new Date(profile.createdAt))}</p>
                  </div>
                </div>

                {(profile.role === "SELLER" || profile.role === "ADMIN") && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Баланс</p>
                      <p className="font-medium text-lg">{formatPrice(profile.balance)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid sm:grid-cols-2 gap-4"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Покупок</p>
                  <p className="text-3xl font-bold mt-1">{profile._count.purchases}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {(profile.role === "SELLER" || profile.role === "ADMIN") && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Товаров</p>
                    <p className="text-3xl font-bold mt-1">{profile._count.products}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <ChangePassword />
          <TwoFactorSettings 
            twoFactorEnabled={profile.twoFactorEnabled} 
            onStatusChange={fetchProfile}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
