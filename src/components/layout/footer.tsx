"use client"

import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import { useState, useEffect } from "react"
import { useSiteName } from "@/components/layout/site-name-provider"

export function Footer() {
  // Название приходит из layout'а, описание — по-прежнему запросом:
  // в разметку оно не попадает раньше, чем страница отрисована.
  const siteName = useSiteName()
  const [siteDescription, setSiteDescription] = useState("Маркетплейс цифровых товаров. Покупайте и продавайте программы, игры, музыку и многое другое.")

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.siteDescription) {
          setSiteDescription(data.data.siteDescription)
        }
      })
      .catch(() => {})
  }, [])
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
              <li><Link href="/category/software" className="hover:text-primary transition-colors">Программы</Link></li>
              <li><Link href="/category/games" className="hover:text-primary transition-colors">Игры</Link></li>
              <li><Link href="/category/music" className="hover:text-primary transition-colors">Музыка</Link></li>
              <li><Link href="/category/graphics" className="hover:text-primary transition-colors">Графика</Link></li>
              <li><Link href="/category/ebooks" className="hover:text-primary transition-colors">Электронные книги</Link></li>
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
