"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * Постраничная навигация по выдаче товаров.
 *
 * Два режима вместо двух компонентов: страница категории серверная, и
 * переход по ней обязан быть ссылкой — такой адрес можно переслать и
 * отдать поисковику. Каталог держит фильтры в состоянии, и там переход
 * идёт запросом к API, без перезагрузки страницы. Разметка у обоих
 * общая, иначе два списка одних и тех же карточек листались бы
 * по-разному.
 */

/** «1 товар», «2 товара», «5 товаров» — иначе подпись выглядит машинной. */
function productsWord(count: number): string {
  const mod100 = count % 100

  if (mod100 >= 11 && mod100 <= 14) {
    return "товаров"
  }

  switch (count % 10) {
    case 1:
      return "товар"
    case 2:
    case 3:
    case 4:
      return "товара"
    default:
      return "товаров"
  }
}

interface CatalogPaginationProps {
  page: number
  totalPages: number
  total: number
  /** Ссылочный режим: адрес страницы. Задают серверные страницы. */
  hrefForPage?: (page: number) => string
  /** Режим состояния: смена страницы без перезагрузки. */
  onPageChange?: (page: number) => void
}

export function CatalogPagination({
  page,
  totalPages,
  total,
  hrefForPage,
  onPageChange,
}: CatalogPaginationProps) {
  // Одна страница — листать нечего.
  if (totalPages <= 1) {
    return null
  }

  const renderStep = (target: number, label: string, enabled: boolean) => {
    if (!enabled) {
      return (
        <Button size="sm" variant="outline" disabled>
          {label}
        </Button>
      )
    }

    if (hrefForPage) {
      return (
        <Button size="sm" variant="outline" asChild>
          <Link href={hrefForPage(target)}>{label}</Link>
        </Button>
      )
    }

    return (
      <Button size="sm" variant="outline" onClick={() => onPageChange?.(target)}>
        {label}
      </Button>
    )
  }

  return (
    <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Страница {page} из {totalPages} · {total} {productsWord(total)}
      </p>
      <div className="flex gap-2">
        {renderStep(page - 1, "Назад", page > 1)}
        {renderStep(page + 1, "Вперёд", page < totalPages)}
      </div>
    </div>
  )
}
