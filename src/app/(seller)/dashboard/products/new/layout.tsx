import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { canManageProducts } from "@/lib/platform-mode"

/**
 * В режиме одного продавца товар заводит только администратор. API это
 * уже проверяет; здесь мы не показываем форму, которая всё равно
 * ответит отказом. Список товаров при этом остаётся открытым, поэтому
 * охрана висит на форме, а не на всём разделе.
 */
export default async function NewProductLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!(await canManageProducts(session?.user?.role))) {
    redirect("/dashboard/products")
  }

  return <>{children}</>
}
