import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isSingleVendorMode } from "@/lib/platform-mode"

/**
 * В режиме одного продавца товарами распоряжается только
 * администратор. API это уже проверяет; здесь мы не показываем формы,
 * которые всё равно ответят отказом — вместе с разделом «Товары»
 * в боковом меню.
 */
export default async function SellerProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (session?.user?.role !== "ADMIN" && (await isSingleVendorMode())) {
    redirect("/dashboard")
  }

  return <>{children}</>
}
