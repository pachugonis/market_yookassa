import { prisma } from "@/lib/prisma"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserRole } from "@prisma/client"

async function getUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          products: true,
          purchases: true,
        },
      },
    },
  })
  return users
}

function getRoleBadge(role: UserRole) {
  const variants = {
    ADMIN: "destructive",
    SELLER: "default",
    BUYER: "secondary",
  } as const

  const labels = {
    ADMIN: "Администратор",
    SELLER: "Продавец",
    BUYER: "Покупатель",
  }

  return (
    <Badge variant={variants[role]}>
      {labels[role]}
    </Badge>
  )
}

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Пользователи</h1>
        <p className="text-muted-foreground mt-2">Управление пользователями платформы</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left p-4 font-medium">Пользователь</th>
                <th className="text-left p-4 font-medium">Email</th>
                <th className="text-left p-4 font-medium">Роль</th>
                <th className="text-left p-4 font-medium">Товары</th>
                <th className="text-left p-4 font-medium">Покупки</th>
                <th className="text-left p-4 font-medium">Баланс</th>
                <th className="text-left p-4 font-medium">Дата регистрации</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: any) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        {user.verified && (
                          <span className="text-xs text-green-600">✓ Подтвержден</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{user.email}</td>
                  <td className="p-4">{getRoleBadge(user.role)}</td>
                  <td className="p-4 text-center">{user._count.products}</td>
                  <td className="p-4 text-center">{user._count.purchases}</td>
                  <td className="p-4">
                    <span className="font-medium">{(user.balance / 100).toFixed(2)} ₽</span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Всего пользователей</h3>
          <p className="text-3xl font-bold">{users.length}</p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Продавцов</h3>
          <p className="text-3xl font-bold">{users.filter((u: any) => u.role === "SELLER").length}</p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Покупателей</h3>
          <p className="text-3xl font-bold">{users.filter((u: any) => u.role === "BUYER").length}</p>
        </Card>
      </div>
    </div>
  )
}
