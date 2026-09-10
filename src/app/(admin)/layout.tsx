import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminSidebar, AdminMobileNav } from "@/components/layout/admin-sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/admin-login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/")
  }

  return (
    // `min-w-0` обязателен: без него колонка с контентом не сжимается
    // уже своих широких таблиц и растягивает страницу вбок.
    <div className="min-h-screen flex">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav />
        <main className="flex-1 bg-secondary/20 p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
