"use client"

import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import { getImageProps } from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { HomeBanner } from "@/lib/banners"

/** Сколько баннер стоит на экране, прежде чем карусель перелистнёт. */
const AUTOPLAY_INTERVAL_MS = 6000

/**
 * Ширина баннера: страница в контейнере, у которого на самых широких
 * экранах 1536 px минус отступы по 16 px, а ниже — вся ширина окна.
 */
const IMAGE_SIZES = "(min-width: 1536px) 1504px, calc(100vw - 32px)"

/** Граница телефонной картинки — та же, что у `md:` в Tailwind. */
const MOBILE_MEDIA = "(max-width: 767px)"

/**
 * Картинка баннера. `<picture>` вместо `<Image>`: у баннера может быть
 * отдельная картинка для телефона, и браузер должен скачать только
 * одну из двух, а не обе с последующим скрытием лишней.
 */
function BannerPicture({ banner, isFirst }: { banner: HomeBanner; isFirst: boolean }) {
  const common = {
    alt: banner.title,
    fill: true,
    sizes: IMAGE_SIZES,
    draggable: false,
    className: "select-none object-cover",
  }

  // Первый баннер — самое крупное, что видно при открытии главной,
  // поэтому грузится сразу и в первую очередь.
  const { props: desktop } = getImageProps({
    ...common,
    src: banner.imageUrl,
    ...(isFirst && { loading: "eager" as const, fetchPriority: "high" as const }),
  })

  const mobileSrcSet = banner.mobileImageUrl
    ? getImageProps({ ...common, src: banner.mobileImageUrl }).props.srcSet
    : undefined

  return (
    <picture>
      {mobileSrcSet && (
        <source media={MOBILE_MEDIA} srcSet={mobileSrcSet} sizes={IMAGE_SIZES} />
      )}
      <img {...desktop} alt={banner.title} />
    </picture>
  )
}

function BannerSlide({ banner, isFirst }: { banner: HomeBanner; isFirst: boolean }) {
  const picture = <BannerPicture banner={banner} isFirst={isFirst} />

  if (!banner.link) return picture

  // Свои страницы открываем переходом без перезагрузки, чужие — в
  // новой вкладке, чтобы покупатель не терял площадку.
  if (banner.link.startsWith("/")) {
    return (
      <Link href={banner.link} className="block h-full w-full" draggable={false}>
        {picture}
      </Link>
    )
  }

  return (
    <a
      href={banner.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full w-full"
      draggable={false}
    >
      {picture}
    </a>
  )
}

/**
 * Карусель баннеров вверху главной.
 *
 * Лента — обычная горизонтальная прокрутка со snap: свайп на телефоне
 * и трекпаде даёт браузер, а стрелки и полоски только прокручивают её
 * к нужному баннеру. Текущий баннер вычисляется из положения прокрутки,
 * поэтому все способы листания сходятся в одном месте.
 */
export function BannerCarousel({ banners }: { banners: HomeBanner[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const [isPageHidden, setIsPageHidden] = useState(false)

  useEffect(() => {
    const update = () => setIsPageHidden(document.hidden)
    document.addEventListener("visibilitychange", update)
    return () => document.removeEventListener("visibilitychange", update)
  }, [])

  const count = banners.length
  if (count === 0) return null

  // После удаления баннеров в админке номер текущего может оказаться
  // за концом списка — до ближайшей прокрутки держим его в границах.
  const active = Math.min(current, count - 1)

  // Пока покупатель смотрит на баннер, читает его или листает сам,
  // карусель не должна уводить картинку у него из-под рук.
  const isPaused = isHovered || isFocused || isTouching || isPageHidden

  // Телефонные картинки рисуют выше основных (2:1 против 4:1). Если их
  // нет ни у одного баннера, на телефоне показываем основные целиком,
  // а не обрезаем их по краям до пустой середины.
  const hasMobileImages = banners.some((banner) => banner.mobileImageUrl)

  const goTo = (index: number) => {
    const track = trackRef.current
    if (!track) return

    const target = (index + count) % count
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    track.scrollTo({
      left: target * track.clientWidth,
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }

  const handleScroll = () => {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return

    const index = Math.round(track.scrollLeft / track.clientWidth)
    setCurrent(Math.min(Math.max(index, 0), count - 1))
  }

  return (
    <section
      aria-roledescription="карусель"
      aria-label="Акции и новости"
      className="container mx-auto px-4 py-4 md:py-6"
    >
      <div
        className="relative overflow-hidden rounded-2xl bg-secondary md:rounded-3xl"
        onPointerEnter={(e) => e.pointerType === "mouse" && setIsHovered(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setIsHovered(false)}
        // Паузу даёт только фокус с клавиатуры: после щелчка мышью по
        // стрелке фокус остаётся на ней, и карусель иначе замерла бы
        // до первого щелчка в другом месте страницы.
        onFocus={(e) => setIsFocused(e.target.matches(":focus-visible"))}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setIsFocused(false)
        }}
        onTouchStart={() => setIsTouching(true)}
        onTouchEnd={() => setIsTouching(false)}
        onTouchCancel={() => setIsTouching(false)}
      >
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className={cn(
            // overscroll-contain: свайп за край ленты не должен
            // превращаться в жест «назад» у браузера.
            "banner-track flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain md:aspect-[4/1]",
            hasMobileImages ? "aspect-[2/1]" : "aspect-[4/1]"
          )}
        >
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              role="group"
              aria-roledescription="слайд"
              aria-label={`${index + 1} из ${count}: ${banner.title}`}
              // Ссылки уехавших за край баннеров не должны ловить Tab:
              // фокус на невидимом элементе не видно.
              inert={index !== active}
              className="relative h-full w-full shrink-0 snap-start snap-always"
            >
              <BannerSlide banner={banner} isFirst={index === 0} />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            {/* На телефоне листают пальцем, стрелки там только закрыли бы картинку. */}
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              aria-label="Предыдущий баннер"
              className="absolute left-4 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-900 shadow-md backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label="Следующий баннер"
              className="absolute right-4 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-900 shadow-md backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            {/* Полоски как в сторис: пройденные залиты, текущая
                заполняется по таймеру, следующие — полупрозрачные. */}
            <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1.5 md:bottom-3">
              {banners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Показать баннер ${index + 1}: ${banner.title}`}
                  aria-current={index === active}
                  className="rounded-full py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span
                    className={cn(
                      "relative block h-[3px] w-5 overflow-hidden rounded-full shadow-[0_0_2px_rgba(0,0,0,0.5)] md:w-10",
                      index < active ? "bg-white" : "bg-white/45"
                    )}
                  >
                    {index === active && (
                      <span
                        // Новый ключ — новая анимация: таймер
                        // начинается заново для каждого баннера.
                        key={active}
                        className="banner-progress absolute inset-0 rounded-full bg-white"
                        data-paused={isPaused}
                        style={{ "--banner-interval": `${AUTOPLAY_INTERVAL_MS}ms` } as CSSProperties}
                        onAnimationEnd={() => goTo(active + 1)}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
