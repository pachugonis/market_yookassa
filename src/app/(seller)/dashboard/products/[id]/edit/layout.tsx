import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { canManageProducts } from "@/lib/platform-mode"

/**
 * Правка закрыта вместе с созданием: иначе в старой карточке можно
 * заменить название, описание и цену — то есть выставить новый товар в
 * обход запрета. Снять товар с продажи продавец может из списка.
 */
export default async function EditProductLayout({
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
