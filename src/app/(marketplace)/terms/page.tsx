import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { absoluteUrl, SITE_NAME } from "@/lib/seo"
import { DISPUTE_WINDOW_HOURS } from "@/lib/dispute-window"

export const metadata: Metadata = {
  title: "Условия использования",
  description: `Условия использования маркетплейса ${SITE_NAME}: правила покупки и продажи цифровых товаров, оплата, возвраты и разрешение споров.`,
  alternates: { canonical: absoluteUrl("/terms") },
}

export default async function TermsPage() {
  const settings = await prisma.platformSettings.findFirst({
    select: { commissionRate: true, supportEmail: true, singleVendorMode: true },
  })

  const commission = settings?.commissionRate ?? 10
  const supportEmail = settings?.supportEmail ?? "support@example.com"
  // Порядок расчётов у режимов разный, и условия должны описывать тот,
  // по которому площадка действительно работает.
  const instantCapture = settings?.singleVendorMode ?? false

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">Условия использования</h1>
      <p className="text-sm text-muted-foreground mb-10">
        Редакция от {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <div className="space-y-8 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">1. Общие положения</h2>
          <p>
            Настоящие условия регулируют использование маркетплейса {SITE_NAME} (далее — Площадка).
            Регистрируясь или совершая покупку, пользователь подтверждает согласие с этими условиями.
            Площадка выступает посредником между продавцом и покупателем цифровых товаров и не является
            их автором или правообладателем.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">2. Учётная запись</h2>
          <p>
            Для покупки и продажи требуется регистрация. Пользователь отвечает за сохранность пароля
            и за все действия, совершённые под его учётной записью. Передача доступа третьим лицам
            не допускается. Площадка вправе заблокировать учётную запись при нарушении настоящих условий.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">3. Покупка товаров</h2>
          <p>
            Оплата проводится через платёжные сервисы ЮKassa и CloudPayments — способ покупатель
            выбирает при оформлении заказа.{" "}
            {instantCapture
              ? `Средства списываются сразу после оплаты; в течение ${DISPUTE_WINDOW_HOURS} часов покупатель вправе открыть спор.`
              : "Средства холдируются и перечисляются продавцу после подтверждения сделки."}{" "}
            После оплаты покупатель получает доступ к файлу
            или лицензионному ключу в разделе «Мои покупки». Доступ к купленному товару сохраняется
            за покупателем бессрочно, пока действует Площадка.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">4. Продажа товаров</h2>
          <p>
            Продавец гарантирует, что обладает правами на размещаемый товар и что товар не нарушает
            прав третьих лиц и законодательства РФ. Площадка удерживает комиссию в размере {commission}%
            от суммы каждой продажи. Оставшаяся сумма доступна продавцу к выводу из личного кабинета.
          </p>
          <p className="mt-3">
            Запрещено размещать: вредоносное ПО, взломанные и пиратские копии, материалы с чужими
            объектами авторского права без разрешения, а также любой контент, запрещённый законом.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">5. Возврат и споры</h2>
          <p>
            Цифровой товар передаётся в момент оплаты, поэтому возврат по причине «передумал»
            не производится. Если товар не соответствует описанию, повреждён или не работает,
            покупатель вправе открыть спор в течение срока, указанного в интерфейсе сделки.
            Спор рассматривает модератор Площадки; при решении в пользу покупателя средства возвращаются.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">6. Ответственность</h2>
          <p>
            Площадка не несёт ответственности за содержание товаров, размещённых продавцами,
            и за убытки, возникшие вследствие их использования. Площадка не гарантирует
            непрерывную работу сервиса и вправе проводить технические работы.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">7. Изменение условий</h2>
          <p>
            Площадка вправе изменять настоящие условия. Актуальная редакция всегда опубликована
            на этой странице. Продолжение использования сервиса после изменений означает согласие
            с новой редакцией.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">8. Контакты</h2>
          <p>
            Вопросы по условиям использования: <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">{supportEmail}</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
