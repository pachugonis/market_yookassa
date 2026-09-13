import Image from "next/image"
import { getCategoryIconOption, isImageIcon } from "@/lib/category-icons"
import { cn } from "@/lib/utils"

interface CategoryIconProps {
  /// Значение Category.icon: имя иконки из набора, путь к картинке или эмодзи.
  icon: string
  /// Название категории — уходит в alt картинки.
  label: string
  /// Размер загруженной картинки в пикселях; на иконки набора не влияет,
  /// им размер задаёт className.
  size?: number
  className?: string
  /// Картинку почти всегда показывают во весь отведённый квадрат, а иконке
  /// набора нужны отступы внутри него — иначе она упирается в края.
  imageClassName?: string
}

/// Одна точка отрисовки иконки категории: в базе лежат значения трёх видов,
/// и раньше каждое место разбирало их само — набор в меню расходился с
/// набором в админке.
export function CategoryIcon({
  icon,
  label,
  size = 16,
  className,
  imageClassName,
}: CategoryIconProps) {
  if (isImageIcon(icon)) {
    return (
      <span
        className={cn(
          "relative inline-block shrink-0 overflow-hidden rounded",
          imageClassName ?? className
        )}
      >
        {/* Иконка лежит в /category-icons и раздаётся nginx напрямую:
            next start не видит файлы, загруженные в public/ после запуска,
            и /_next/image отвечал бы 404. */}
        <Image
          src={icon}
          alt={label}
          width={size}
          height={size}
          unoptimized
          className="h-full w-full object-cover"
        />
      </span>
    )
  }

  const option = getCategoryIconOption(icon)
  const Icon = option?.Icon

  if (Icon) {
    return <Icon className={cn("shrink-0", className)} aria-hidden="true" />
  }

  // Эмодзи или произвольный текст, оставшийся от старых категорий.
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}
      aria-hidden="true"
    >
      {icon}
    </span>
  )
}
