"use client"

import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import {
  useSiteDescription,
  useSiteName,
} from "@/components/layout/site-settings-provider"

// Ссылки на разделы прописаны вручную, а не берутся из базы: в футере
// нужны несколько главных, а не все подряд.
const FOOTER_CATEGORIES = [
  { slug: "software", name: "Программы" },
  { slug: "games", name: "Игры" },
  { slug: "music", name: "Музыка" },
  { slug: "graphics", name: "Графика" },
  { slug: "ebooks", name: "Электронные книги" },
]

interface FooterProps {
  /** Slug'и категорий, видимых на сайте: скрытые в админке не показываем. */
  categorySlugs: string[]
}

export function Footer({ categorySlugs }: FooterProps) {
  const footerCategories = FOOTER_CATEGORIES.filter((category) =>
    categorySlugs.includes(category.slug)
  )
  // Название и описание приходят из layout'а уже отрисованными: запрос
  // из браузера показывал бы значения по умолчанию до первого ответа.
  const siteName = useSiteName()
  const siteDescription = useSiteDescription()

  return (
    <footer className="border-t bg-secondary/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo & Description */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
              <ShoppingBag className="h-7 w-7" />
              {siteName}
            </Link>
            <p className="text-sm text-muted-foreground">
              {siteDescription}
            </p>
          </div>

          {/* Каталог */}
          <div>
            <h3 className="font-semibold mb-4">Каталог</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {footerCategories.map((category) => (
                <li key={category.slug}>
                  <Link href={`/category/${category.slug}`} className="hover:text-primary transition-colors">
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Информация */}
          <div>
            <h3 className="font-semibold mb-4">Информация</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-primary transition-colors">О нас</Link></li>
              <li><Link href="/terms" className="hover:text-primary transition-colors">Условия использования</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">Политика конфиденциальности</Link></li>
              <li><Link href="/support" className="hover:text-primary transition-colors">Поддержка</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {siteName}. Все права защищены.</p>
        </div>
      </div>
    </footer>
  )
}
