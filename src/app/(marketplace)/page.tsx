"use client"

import Link from "next/link"
import { motion } from "framer-motion"
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

const categories = [
  { name: "Программы", slug: "software", icon: Monitor, color: "from-blue-500 to-cyan-500" },
  { name: "Игры", slug: "games", icon: Gamepad2, color: "from-purple-500 to-pink-500" },
  { name: "Музыка", slug: "music", icon: Music, color: "from-green-500 to-emerald-500" },
  { name: "Видео", slug: "video", icon: Video, color: "from-red-500 to-orange-500" },
  { name: "Графика", slug: "graphics", icon: ImageIcon, color: "from-yellow-500 to-amber-500" },
  { name: "Шаблоны", slug: "templates", icon: Layout, color: "from-indigo-500 to-violet-500" },
  { name: "Электронные книги", slug: "ebooks", icon: BookOpen, color: "from-teal-500 to-cyan-500" },
  { name: "Документы", slug: "documents", icon: FileText, color: "from-slate-500 to-gray-500" },
]

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

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-bg">
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
            {categories.map((category) => (
              <motion.div key={category.slug} variants={itemVariants}>
                <Link href={`/category/${category.slug}`}>
                  <div className="relative group">
                    <Card className="relative overflow-hidden h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-500">
                      {/* Animated Background Gradient */}
                      <div className={`absolute inset-0 opacity-50 group-hover:opacity-70 transition-opacity duration-500 bg-gradient-to-br ${category.color}`} />
                      
                      {/* Animated Border Glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/20 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      
                      <CardContent className="p-6 text-center relative">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center mx-auto mb-4 transform group-hover:scale-110 transition-transform duration-300`}>
                          <category.icon className="h-7 w-7 text-white" />
                        </div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">
                          {category.name}
                        </h3>
                      </CardContent>
                      
                      {/* Decorative Element */}
                      <div className="absolute bottom-0 right-0 w-20 h-20 bg-primary/5 rounded-tl-full transform translate-x-10 translate-y-10 group-hover:translate-x-8 group-hover:translate-y-8 transition-transform duration-500" />
                    </Card>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Magic Bento Section */}
      <section className="py-16 md:py-24 bg-secondary/10">
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
