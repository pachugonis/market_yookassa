"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Home, Search, ShoppingBag, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 py-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center"
        >
          {/* 404 Number */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mb-8"
          >
            <h1 className="text-9xl md:text-[200px] font-bold bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent leading-none">
              404
            </h1>
          </motion.div>

          {/* Message Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-8 glass border-primary/20 shadow-xl shadow-primary/10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6"
              >
                <ShoppingBag className="h-4 w-4" />
                Страница не найдена
              </motion.div>

              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Упс! Эта страница потерялась
              </h2>
              
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Возможно, вы перешли по устаревшей ссылке или страница была перемещена. 
                Не переживайте, вы можете вернуться на главную или воспользоваться поиском.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <Button size="lg" className="w-full sm:w-auto">
                    <Home className="h-5 w-5" />
                    На главную
                  </Button>
                </Link>
                
                <Link href="/products">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    <Search className="h-5 w-5" />
                    Смотреть каталог
                  </Button>
                </Link>
              </div>

              {/* Back Link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-6"
              >
                <button
                  onClick={() => window.history.back()}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Вернуться назад
                </button>
              </motion.div>
            </Card>
          </motion.div>

          {/* Popular Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8"
          >
            <p className="text-sm text-muted-foreground mb-4">
              Популярные разделы:
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/category/software">
                <Button variant="ghost" size="sm" className="text-xs">
                  Программы
                </Button>
              </Link>
              <Link href="/category/games">
                <Button variant="ghost" size="sm" className="text-xs">
                  Игры
                </Button>
              </Link>
              <Link href="/category/music">
                <Button variant="ghost" size="sm" className="text-xs">
                  Музыка
                </Button>
              </Link>
              <Link href="/category/graphics">
                <Button variant="ghost" size="sm" className="text-xs">
                  Графика
                </Button>
              </Link>
              <Link href="/about">
                <Button variant="ghost" size="sm" className="text-xs">
                  О нас
                </Button>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
