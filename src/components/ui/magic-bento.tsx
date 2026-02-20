"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface BentoItem {
  title: string
  description: string
  className?: string
  icon?: React.ReactNode
  gradient?: string
}

interface MagicBentoProps {
  items: BentoItem[]
  className?: string
}

export function MagicBento({ items, className }: MagicBentoProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {items.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1 }}
          className={cn(
            "relative group",
            item.className
          )}
        >
          <Card className="relative overflow-hidden h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-500">
            {/* Animated Background Gradient */}
            <div 
              className={cn(
                "absolute inset-0 opacity-50 group-hover:opacity-70 transition-opacity duration-500",
                item.gradient || "bg-gradient-to-br from-primary/20 to-primary/5"
              )}
            />
            
            {/* Animated Border Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/20 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Content */}
            <div className="relative p-6 md:p-8 h-full flex flex-col justify-between">
              <div>
                {item.icon && (
                  <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
                    {item.icon}
                  </div>
                )}
                <h3 className="text-xl md:text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm md:text-base">
                  {item.description}
                </p>
              </div>
              
              {/* Decorative Element */}
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 rounded-tl-full transform translate-x-16 translate-y-16 group-hover:translate-x-12 group-hover:translate-y-12 transition-transform duration-500" />
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
