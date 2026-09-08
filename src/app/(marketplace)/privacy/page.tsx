import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { absoluteUrl, SITE_NAME } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: `Политика конфиденциальности ${SITE_NAME}: какие персональные данные собирает площадка, зачем они нужны, как хранятся и как их удалить.`,
  alternates: { canonical: absoluteUrl("/privacy") },
}

export default async function PrivacyPage() {
  const settings = await prisma.platformSettings.findFirst({
    select: { supportEmail: true },
  })

  const supportEmail = settings?.supportEmail ?? "support@example.com"

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">Политика конфиденциальности</h1>
      <p className="text-sm text-muted-foreground mb-10">
        Редакция от {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <div className="space-y-8 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">1. Какие данные мы собираем</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><span className="text-foreground">Регистрационные данные</span> — имя и адрес электронной почты.</li>
            <li><span className="text-foreground">Данные профиля</span> — аватар и иные сведения, которые пользователь указывает добровольно.</li>
            <li><span className="text-foreground">Данные о сделках</span> — история покупок, продаж, выплат и споров.</li>
            <li><span className="text-foreground">Технические данные</span> — IP-адрес, сведения об устройстве и браузере, журналы доступа.</li>
          </ul>
          <p className="mt-3">
            Данные банковских карт Площадка не получает и не хранит: их обрабатывает
            платёжный сервис ЮKassa на своей стороне.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">2. Зачем мы их используем</h2>
          <p>
            Для регистрации и входа, проведения и подтверждения оплаты, выдачи доступа к купленным
            товарам, начисления выплат продавцам, рассмотрения споров, отправки сервисных уведомлений
            и обеспечения безопасности площадки.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">3. Передача третьим лицам</h2>
          <p>
            Персональные данные передаются только в объёме, необходимом для работы сервиса:
            платёжному сервису ЮKassa — для проведения расчётов, почтовому провайдеру —
            для отправки уведомлений, а также уполномоченным государственным органам
            в случаях, предусмотренных законом. Мы не продаём персональные данные.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">4. Cookies</h2>
          <p>
            Площадка использует cookies для поддержания сессии авторизованного пользователя
            и сохранения настроек интерфейса. Отключение cookies в браузере сделает вход
            в учётную запись невозможным.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">5. Хранение и защита</h2>
          <p>
            Пароли хранятся только в виде необратимых хешей. Доступ к данным ограничен
            и предоставляется сотрудникам исключительно для выполнения их задач. Данные хранятся
            в течение срока действия учётной записи, а сведения о сделках — в течение срока,
            установленного законодательством для документов бухгалтерского учёта.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">6. Права пользователя</h2>
          <p>
            Пользователь вправе получить сведения об обрабатываемых данных, потребовать их
            исправления, удаления или отозвать согласие на обработку. Для этого направьте запрос
            на адрес поддержки. Удаление учётной записи не затрагивает сведения о завершённых
            сделках, которые Площадка обязана хранить по закону.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">7. Контакты</h2>
          <p>
            По вопросам обработки персональных данных: <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">{supportEmail}</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
