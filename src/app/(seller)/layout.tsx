import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { SellerSidebar, SellerMobileNav } from "@/components/layout/seller-sidebar"
import { SellerCapabilitiesProvider } from "@/components/seller/seller-capabilities"
import { SiteSettingsProvider } from "@/components/layout/site-settings-provider"
import { canManageProducts } from "@/lib/platform-mode"
import { getSiteSettings } from "@/lib/site-settings"

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
  const siteSettings = await getSiteSettings()

  return (
    <SellerCapabilitiesProvider value={{ canManageProducts: productsEditable }}>
      <SiteSettingsProvider value={siteSettings}>
        {/* `min-w-0` не даёт широким таблицам растянуть страницу вбок. */}
        <div className="min-h-screen flex">
          <SellerSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <SellerMobileNav />
            <main className="flex-1 bg-secondary/20 p-4 sm:p-6 md:p-8">{children}</main>
          </div>
        </div>
      </SiteSettingsProvider>
    </SellerCapabilitiesProvider>
  )
}
