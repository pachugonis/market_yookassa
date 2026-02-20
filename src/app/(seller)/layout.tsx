import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { SellerSidebar } from "@/components/layout/seller-sidebar"

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
    redirect("/")
  }

  return (
    <div className="min-h-screen flex">
      <SellerSidebar />
      <main className="flex-1 p-6 md:p-8 bg-secondary/20">{children}</main>
    </div>
  )
}
