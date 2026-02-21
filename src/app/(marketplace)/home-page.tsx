"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import Image from "next/image"
import { 
  Monitor, 
  Gamepad2, 
  Music, 
  Video, 
  Image as ImageIcon, 
  Layout, 
  BookOpen, 
  FileText,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  Users,
  TrendingUp,
  HeadphonesIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MagicBento } from "@/components/ui/magic-bento"

const iconMap: Record<string, any> = {
  Monitor,
  Gamepad2,
  Music,
  Video,
  Image: ImageIcon,
  Layout,
  BookOpen,
  FileText,
}

const colorMap: Record<string, string> = {
  software: "from-blue-500 to-cyan-500",
  games: "from-purple-500 to-pink-500",
  music: "from-green-500 to-emerald-500",
  video: "from-red-500 to-orange-500",
  graphics: "from-yellow-500 to-amber-500",
  templates: "from-indigo-500 to-violet-500",
  ebooks: "from-teal-500 to-cyan-500",
  documents: "from-slate-500 to-gray-500",
}

const bentoItems = [
  {
    title: "Безопасные платежи",
    description: "Оплата через YooKassa с защитой покупателя",
    icon: <Shield className="h-10 w-10 text-primary" />,
    className: "md:col-span-1",
    gradient: "bg-gradient-to-br from-blue-500/20 to-cyan-500/10"
  },
  {
    title: "Мгновенная доставка",
    description: "Скачивайте товары сразу после оплаты",
    icon: <Zap className="h-10 w-10 text-primary" />,
    className: "md:col-span-1",
    gradient: "bg-gradient-to-br from-purple-500/20 to-pink-500/10"
  },
  {
    title: "Качественные товары",
    description: "Проверенные продавцы и модерация контента",
    icon: <Sparkles className="h-10 w-10 text-primary" />,
    className: "md:col-span-1",
    gradient: "bg-gradient-to-br from-green-500/20 to-emerald-500/10"
  },
  {
    title: "Активное сообщество",
    description: "Тысячи покупателей и продавцов со всего мира",
    icon: <Users className="h-10 w-10 text-primary" />,
    className: "md:col-span-1",
    gradient: "bg-gradient-to-br from-orange-500/20 to-red-500/10"
  },
  {
    title: "Выгодные цены",
    description: "Конкурентные предложения и регулярные акции",
    icon: <TrendingUp className="h-10 w-10 text-primary" />,
    className: "md:col-span-1",
    gradient: "bg-gradient-to-br from-yellow-500/20 to-amber-500/10"
  },
  {
    title: "Поддержка 24/7",
    description: "Всегда готовы помочь с любыми вопросами",
    icon: <HeadphonesIcon className="h-10 w-10 text-primary" />,
    className: "md:col-span-1",
    gradient: "bg-gradient-to-br from-indigo-500/20 to-violet-500/10"
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

interface HomePageProps {
  categories: Array<{
    id: string
    name: string
    slug: string
    icon: string
    description: string | null
  }>
}

export function HomePage({ categories }: HomePageProps) {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative gradient-bg overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6"
            >
              <Sparkles className="h-4 w-4" />
              Маркетплейс цифровых товаров
            </motion.div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              Покупайте и продавайте цифровые товары
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Программы, игры, музыка, графика и многое другое. Мгновенная доставка и безопасные платежи через YooKassa.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/products">
                <Button size="lg" className="w-full sm:w-auto text-base">
                  Смотреть каталог
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base">
                  Начать продавать
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </section>

      {/* Categories Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Категории товаров</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Выберите интересующую вас категорию и найдите то, что нужно
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
          >
            {categories.map((category) => {
              const Icon = iconMap[category.icon] || Monitor
              const color = colorMap[category.slug] || "from-gray-500 to-slate-500"
              const isImageIcon = category.icon.startsWith("/") || category.icon.startsWith("http")
              
              return (
                <motion.div key={category.slug} variants={itemVariants}>
                  <Link href={`/category/${category.slug}`}>
                    <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full">
                      <CardContent className="p-6">
                        <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                        <div className="relative z-10">
                          {isImageIcon ? (
                            <div className="relative w-12 h-12 mb-4 rounded overflow-hidden group-hover:scale-110 transition-transform duration-300">
                              <Image
                                src={category.icon}
                                alt={category.name}
                                width={48}
                                height={48}
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <Icon className="h-12 w-12 mb-4 text-primary group-hover:scale-110 transition-transform duration-300" />
                          )}
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {category.name}
                          </h3>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* MagicBento Section */}
      <section className="py-16 md:py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Почему выбирают нас</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Надежная платформа для покупки и продажи цифровых товаров
            </p>
          </motion.div>

          <MagicBento items={bentoItems} />
        </div>
      </section>
    </div>
  )
}
