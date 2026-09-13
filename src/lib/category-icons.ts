import {
  AppWindow,
  BarChart3,
  Blocks,
  BookOpen,
  Bot,
  Box,
  BrainCircuit,
  Brush,
  CalendarDays,
  Camera,
  Cloud,
  Code2,
  Coins,
  Database,
  FileCode,
  FileText,
  Film,
  Gamepad2,
  Globe,
  GraduationCap,
  Headphones,
  HeartPulse,
  Image as ImageIcon,
  Layout,
  LayoutTemplate,
  Lightbulb,
  Megaphone,
  MessageSquareCode,
  Mic,
  Monitor,
  Music,
  Package,
  Palette,
  PenTool,
  Presentation,
  Puzzle,
  Shapes,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Swords,
  Table,
  Terminal,
  Type,
  Video,
  Wallet,
  Webhook,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface CategoryIconOption {
  /// Имя экспорта из lucide-react. Оно же лежит в Category.icon, поэтому
  /// переименование иконки здесь осиротит уже сохранённые категории.
  name: string
  label: string
  Icon: LucideIcon
  /// Дополнительные слова для поиска в админке: по одному названию иконка
  /// находится не всегда (например «скрипт» ищут и как «script»).
  keywords?: string
}

export interface CategoryIconGroup {
  title: string
  icons: CategoryIconOption[]
}

/// Набор под цифровой маркетплейс: то, чем торгуют чаще всего. Порядок
/// внутри групп — от популярного к редкому, админка показывает их так же.
export const CATEGORY_ICON_GROUPS: CategoryIconGroup[] = [
  {
    title: "Программы и разработка",
    icons: [
      { name: "Monitor", label: "Программы", Icon: Monitor, keywords: "софт приложение desktop" },
      { name: "FileCode", label: "Скрипт", Icon: FileCode, keywords: "script автоматизация парсер" },
      { name: "AppWindow", label: "Вебприложение", Icon: AppWindow, keywords: "веб приложение web app сервис" },
      { name: "Smartphone", label: "Мобильные приложения", Icon: Smartphone, keywords: "android ios телефон" },
      { name: "Code2", label: "Исходный код", Icon: Code2, keywords: "code программирование" },
      { name: "Terminal", label: "Консоль и CLI", Icon: Terminal, keywords: "terminal командная строка bash" },
      { name: "Puzzle", label: "Плагины", Icon: Puzzle, keywords: "plugin модуль дополнение" },
      { name: "Blocks", label: "Расширения", Icon: Blocks, keywords: "extension браузер" },
      { name: "Webhook", label: "API и интеграции", Icon: Webhook, keywords: "api интеграция webhook" },
      { name: "Bot", label: "Боты", Icon: Bot, keywords: "bot телеграм чат" },
      { name: "BrainCircuit", label: "Нейросети", Icon: BrainCircuit, keywords: "ии ai нейросеть модель" },
      { name: "MessageSquareCode", label: "Промпты", Icon: MessageSquareCode, keywords: "prompt gpt запросы" },
      { name: "Database", label: "Базы данных", Icon: Database, keywords: "база данных sql датасет" },
      { name: "Globe", label: "Сайты", Icon: Globe, keywords: "сайт web лендинг" },
      { name: "Wrench", label: "Утилиты", Icon: Wrench, keywords: "инструменты tools" },
      { name: "ShieldCheck", label: "Безопасность", Icon: ShieldCheck, keywords: "security защита vpn" },
      { name: "Cloud", label: "Облако и хостинг", Icon: Cloud, keywords: "cloud хостинг сервер" },
    ],
  },
  {
    title: "Дизайн и графика",
    icons: [
      { name: "Image", label: "Графика", Icon: ImageIcon, keywords: "изображения картинки" },
      { name: "Shapes", label: "Иконки", Icon: Shapes, keywords: "icon набор" },
      { name: "Type", label: "Шрифты", Icon: Type, keywords: "font типографика" },
      { name: "Layout", label: "Шаблоны", Icon: Layout, keywords: "template заготовки" },
      { name: "LayoutTemplate", label: "Макеты", Icon: LayoutTemplate, keywords: "ui ux figma" },
      { name: "Palette", label: "Дизайн", Icon: Palette, keywords: "design палитра" },
      { name: "Brush", label: "Иллюстрации", Icon: Brush, keywords: "арт рисунок кисти" },
      { name: "PenTool", label: "Векторы", Icon: PenTool, keywords: "vector svg" },
      { name: "Box", label: "3D-модели", Icon: Box, keywords: "3d модель blender" },
      { name: "Camera", label: "Фото", Icon: Camera, keywords: "фотографии сток" },
      { name: "SlidersHorizontal", label: "Пресеты", Icon: SlidersHorizontal, keywords: "preset lut обработка" },
      { name: "Film", label: "Анимация", Icon: Film, keywords: "animation моушн" },
    ],
  },
  {
    title: "Медиа",
    icons: [
      { name: "Music", label: "Музыка", Icon: Music, keywords: "треки альбомы биты" },
      { name: "Headphones", label: "Аудио", Icon: Headphones, keywords: "звуки сэмплы" },
      { name: "Mic", label: "Подкасты", Icon: Mic, keywords: "podcast голос озвучка" },
      { name: "Video", label: "Видео", Icon: Video, keywords: "ролики футаж" },
    ],
  },
  {
    title: "Обучение и документы",
    icons: [
      { name: "BookOpen", label: "Электронные книги", Icon: BookOpen, keywords: "ebook книги" },
      { name: "FileText", label: "Документы", Icon: FileText, keywords: "docs инструкции" },
      { name: "GraduationCap", label: "Курсы", Icon: GraduationCap, keywords: "обучение уроки" },
      { name: "Presentation", label: "Презентации", Icon: Presentation, keywords: "слайды powerpoint" },
      { name: "Table", label: "Таблицы", Icon: Table, keywords: "excel гугл таблицы" },
      { name: "CalendarDays", label: "Планеры", Icon: CalendarDays, keywords: "календарь ежедневник" },
      { name: "Lightbulb", label: "Идеи и гайды", Icon: Lightbulb, keywords: "гайд советы" },
    ],
  },
  {
    title: "Игры",
    icons: [
      { name: "Gamepad2", label: "Игры", Icon: Gamepad2, keywords: "game геймпад" },
      { name: "Swords", label: "Игровые ассеты", Icon: Swords, keywords: "assets моды скины" },
    ],
  },
  {
    title: "Бизнес",
    icons: [
      { name: "BarChart3", label: "Аналитика", Icon: BarChart3, keywords: "графики отчёты статистика" },
      { name: "Megaphone", label: "Маркетинг", Icon: Megaphone, keywords: "реклама смм продвижение" },
      { name: "Wallet", label: "Финансы", Icon: Wallet, keywords: "деньги бухгалтерия" },
      { name: "Coins", label: "Криптовалюты", Icon: Coins, keywords: "crypto токены" },
      { name: "Package", label: "Наборы", Icon: Package, keywords: "bundle архив комплект" },
      { name: "HeartPulse", label: "Здоровье", Icon: HeartPulse, keywords: "спорт фитнес" },
    ],
  },
]

export const CATEGORY_ICONS: CategoryIconOption[] = CATEGORY_ICON_GROUPS.flatMap(
  (group) => group.icons
)

const ICONS_BY_NAME = new Map(CATEGORY_ICONS.map((icon) => [icon.name, icon]))

/// Загруженный файл вместо иконки из набора: путь на своём домене или
/// ссылка наружу.
export function isImageIcon(icon: string): boolean {
  return icon.startsWith("/") || icon.startsWith("http")
}

export function getCategoryIconOption(name: string): CategoryIconOption | undefined {
  return ICONS_BY_NAME.get(name)
}

export function searchCategoryIcons(query: string): CategoryIconGroup[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return CATEGORY_ICON_GROUPS

  return CATEGORY_ICON_GROUPS.map((group) => ({
    title: group.title,
    icons: group.icons.filter((icon) =>
      `${icon.label} ${icon.name} ${icon.keywords ?? ""}`.toLowerCase().includes(needle)
    ),
  })).filter((group) => group.icons.length > 0)
}
