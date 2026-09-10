import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { SellerSidebar } from "@/components/layout/seller-sidebar"
import { SellerCapabilitiesProvider } from "@/components/seller/seller-capabilities"
import { canManageProducts } from "@/lib/platform-mode"

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

  // Кабинет остаётся открытым и в режиме одного продавца: у аккаунтов,
  // заведённых до его включения, там история продаж и остаток на
  // балансе, который ещё предстоит вывести. Закрываются только
  // создание и правка товаров.
  const productsEditable = await canManageProducts(session.user.role)

  return (
    <SellerCapabilitiesProvider value={{ canManageProducts: productsEditable }}>
      <div className="min-h-screen flex">
        <SellerSidebar />
        <main className="flex-1 p-6 md:p-8 bg-secondary/20">{children}</main>
      </div>
    </SellerCapabilitiesProvider>
  )
}
