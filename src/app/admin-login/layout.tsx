// То же, что и на /maintenance: в заголовке вкладки стоит название
// площадки из настроек, и пререндер запомнил бы его навсегда. Сама
// страница — клиентская, а настройку сегмента читают только серверные
// модули, поэтому она живёт здесь.
export const dynamic = "force-dynamic"

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
