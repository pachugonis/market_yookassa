import { unlink } from "fs/promises"
import path from "path"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { UPLOADS_ROOT } from "@/lib/storage"

/**
 * Где лежат картинки баннеров.
 *
 * Не в public/: продакшен-сервер Next видит там только файлы, которые
 * были на диске при его запуске. Загруженный позже баннер не открылся
 * бы до перезапуска приложения — ни напрямую, ни через оптимизатор
 * `/_next/image`, который ходит за картинкой внутрь того же сервера.
 * uploads/ и так постоянное хранилище во всех вариантах установки, а
 * отдаёт картинки маршрут /api/banners/[file].
 */
export const BANNERS_DIR = path.join(UPLOADS_ROOT, "banners")

/** Имя файла картинки: <uuid>.<ext>, расширение — из validateImageBuffer. */
export const BANNER_FILE_NAME = /^[A-Za-z0-9_-]{1,64}\.(?:jpg|png|webp|gif)$/

/** Адрес картинки, который выдаёт /api/upload/banner. */
export const BANNER_IMAGE_PATTERN =
  /^\/api\/banners\/[A-Za-z0-9_-]{1,64}\.(?:jpg|png|webp|gif)$/

export function bannerImageUrl(fileName: string): string {
  return `/api/banners/${fileName}`
}

/**
 * Ссылка баннера: путь на сайте или внешний http(s)-адрес.
 *
 * Список разрешённого, а не запрет опасного: `javascript:`, `data:` и
 * им подобные в href исполнились бы по клику на главной. Путь вида
 * «//host» браузер понимает как адрес чужого сайта, поэтому «/» в
 * начале должен идти без второго слэша.
 */
export function isValidBannerLink(link: string): boolean {
  if (link.startsWith("/")) {
    return !link.startsWith("//") && !link.startsWith("/\\")
  }

  try {
    const url = new URL(link)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

/**
 * Поля баннера, которые правит администратор. Одна схема на создание и
 * правку: для правки её делают частичной, чтобы выключатель в списке
 * мог прислать только `isActive`.
 */
export const bannerSchema = z.object({
  imageUrl: z.string().regex(BANNER_IMAGE_PATTERN, "Загрузите картинку баннера"),
  mobileImageUrl: z
    .string()
    .regex(BANNER_IMAGE_PATTERN, "Недопустимый путь к картинке для телефона")
    .nullable(),
  title: z
    .string()
    .trim()
    .min(1, "Укажите подпись баннера")
    .max(200, "Подпись длиннее 200 символов"),
  // Пустое поле в форме означает «без ссылки».
  link: z
    .string()
    .trim()
    .max(2000, "Ссылка длиннее 2000 символов")
    .transform((value) => value || null)
    .refine((value) => value === null || isValidBannerLink(value), {
      message: "Ссылка должна начинаться с «/» или с http(s)://",
    })
    .nullable(),
  isActive: z.boolean(),
})

export interface HomeBanner {
  id: string
  imageUrl: string
  mobileImageUrl: string | null
  title: string
  link: string | null
}

/** Включённые баннеры в порядке показа — для карусели на главной. */
export async function getActiveBanners(): Promise<HomeBanner[]> {
  return prisma.banner.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      imageUrl: true,
      mobileImageUrl: true,
      title: true,
      link: true,
    },
  })
}

/**
 * Удаляет файл картинки, которая больше не нужна баннеру.
 *
 * Трогаем только то, что подходит под шаблон загрузки: путь приходит
 * из базы, и значение вне шаблона не должно превратиться в удаление
 * произвольного файла. Ошибку глотаем — оставшийся на диске файл хуже
 * не сделает, а упавшее из-за него удаление баннера сделает.
 */
export async function removeBannerImage(imageUrl: string | null | undefined) {
  if (!imageUrl || !BANNER_IMAGE_PATTERN.test(imageUrl)) return

  try {
    await unlink(path.join(BANNERS_DIR, path.posix.basename(imageUrl)))
  } catch {
    // Файла уже нет или нет прав — баннер от этого не зависит.
  }
}
