import Link from "next/link"
import { ShoppingBag } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-secondary/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
              <ShoppingBag className="h-7 w-7" />
              DigiMarket
            </Link>
            <p className="text-sm text-muted-foreground">
              Маркетплейс цифровых товаров. Покупайте и продавайте программы, игры, музыку и многое другое.
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

          {/* Продавцам */}
          <div>
            <h3 className="font-semibold mb-4">Продавцам</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/register" className="hover:text-primary transition-colors">Стать продавцом</Link></li>
              <li><Link href="/dashboard" className="hover:text-primary transition-colors">Панель управления</Link></li>
              <li><span>Комиссия: 10%</span></li>
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
          <p>&copy; {new Date().getFullYear()} DigiMarket. Все права защищены.</p>
        </div>
      </div>
    </footer>
  )
}
