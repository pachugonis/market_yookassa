import type { Metadata } from "next"
import Link from "next/link"
import { Shield, Zap, Wallet, Users } from "lucide-react"
import { absoluteUrl, SITE_NAME } from "@/lib/seo"

export const metadata: Metadata = {
  title: "О нас",
  description: `${SITE_NAME} — маркетплейс цифровых товаров: как устроена площадка, как защищены покупатели и на каких условиях работают продавцы.`,
  alternates: { canonical: absoluteUrl("/about") },
}

const features = [
  {
    icon: Shield,
    title: "Безопасная сделка",
    text: "Оплата проходит через ЮKassa. Деньги холдируются и уходят продавцу только после того, как покупатель получил товар — до этого момента их можно вернуть.",
  },
  {
    icon: Zap,
    title: "Мгновенная доставка",
    text: "Файл или лицензионный ключ становится доступен сразу после подтверждения оплаты, без ожидания и ручной отправки.",
  },
  {
    icon: Wallet,
    title: "Прозрачная комиссия",
    text: "Площадка удерживает фиксированный процент с продажи. Остальное продавец выводит на свой счёт из личного кабинета.",
  },
  {
    icon: Users,
    title: "Споры и модерация",
    text: "Если товар не соответствует описанию, покупатель открывает спор. Решение принимает модератор площадки.",
  },
]

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-bold mb-4">О площадке {SITE_NAME}</h1>
      <p className="text-lg text-muted-foreground mb-10">
        {SITE_NAME} — маркетплейс цифровых товаров. Здесь авторы продают программы,
        игры, музыку, графику, шаблоны и электронные книги, а покупатели получают
        их сразу после оплаты.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 mb-12">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-lg border p-6">
            <Icon className="h-8 w-8 text-primary mb-3" />
            <h2 className="font-semibold text-lg mb-2">{title}</h2>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold mb-3">Как купить</h2>
      <ol className="list-decimal pl-5 space-y-2 text-muted-foreground mb-10">
        <li>Выберите товар в <Link href="/products" className="text-primary hover:underline">каталоге</Link>.</li>
        <li>Оплатите его картой через ЮKassa.</li>
        <li>Скачайте файл в разделе «Мои покупки» — он остаётся доступен и позже.</li>
      </ol>

      <h2 className="text-2xl font-bold mb-3">Как начать продавать</h2>
      <ol className="list-decimal pl-5 space-y-2 text-muted-foreground mb-10">
        <li><Link href="/register" className="text-primary hover:underline">Зарегистрируйтесь</Link> и получите статус продавца.</li>
        <li>Загрузите товар, описание и обложку в панели управления.</li>
        <li>Получайте выплаты после подтверждения продаж.</li>
      </ol>

      <p className="text-muted-foreground">
        Остались вопросы? Загляните в <Link href="/support" className="text-primary hover:underline">поддержку</Link> или
        прочитайте <Link href="/terms" className="text-primary hover:underline">условия использования</Link>.
      </p>
    </div>
  )
}
