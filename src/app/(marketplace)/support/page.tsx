import type { Metadata } from "next"
import Link from "next/link"
import { Mail } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/seo"
import { getSiteName } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName()

  return {
    title: "Поддержка",
    description: `Поддержка ${siteName}: ответы на частые вопросы о покупке, скачивании, возврате и выплатах продавцам, а также контакты службы поддержки.`,
    alternates: { canonical: absoluteUrl("/support") },
  }
}

const faq = [
  {
    q: "Как скачать купленный товар?",
    a: "Откройте раздел «Мои покупки» в своём профиле — там доступны все оплаченные товары. Ссылка на скачивание остаётся активной и после закрытия сайта.",
  },
  {
    q: "Оплата прошла, но товар не появился",
    a: "Подтверждение платежа от платёжного сервиса иногда приходит с задержкой до нескольких минут. Если товар не появился в «Моих покупках» через 15 минут, напишите в поддержку и укажите номер заказа.",
  },
  {
    q: "Можно ли вернуть деньги?",
    a: "Цифровой товар передаётся сразу после оплаты, поэтому возврат «просто так» не предусмотрен. Если товар не соответствует описанию или не работает — откройте спор по сделке, его рассмотрит модератор.",
  },
  {
    q: "Как стать продавцом?",
    a: "Зарегистрируйтесь и запросите статус продавца, после чего в панели управления появится возможность загружать товары.",
  },
  {
    q: "Когда продавец получает деньги?",
    a: "Средства холдируются на стороне платёжного сервиса и перечисляются продавцу после подтверждения сделки. Вывод доступен в разделе «Доходы» панели продавца.",
  },
]

export default async function SupportPage() {
  const settings = await prisma.platformSettings.findFirst({
    select: { supportEmail: true },
  })

  const supportEmail = settings?.supportEmail ?? "support@example.com"

  // Разметка FAQ: Google умеет показывать такие вопросы прямо в выдаче.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <h1 className="text-3xl md:text-4xl font-bold mb-4">Поддержка</h1>
      <p className="text-lg text-muted-foreground mb-10">
        Сначала загляните в частые вопросы — скорее всего, ответ уже есть здесь.
      </p>

      <div className="space-y-6 mb-12">
        {faq.map(({ q, a }) => (
          <div key={q} className="rounded-lg border p-6">
            <h2 className="font-semibold text-lg mb-2">{q}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-secondary/30 p-6">
        <div className="flex items-center gap-3 mb-3">
          <Mail className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Написать в поддержку</h2>
        </div>
        <p className="text-muted-foreground mb-4">
          Если вопрос не решён, напишите нам. Чтобы ответить быстрее, укажите адрес
          вашей учётной записи и номер заказа.
        </p>
        <a href={`mailto:${supportEmail}`} className="text-primary font-medium hover:underline">
          {supportEmail}
        </a>
      </div>

      <p className="text-sm text-muted-foreground mt-8">
        См. также <Link href="/terms" className="text-primary hover:underline">условия использования</Link> и{" "}
        <Link href="/privacy" className="text-primary hover:underline">политику конфиденциальности</Link>.
      </p>
    </div>
  )
}
