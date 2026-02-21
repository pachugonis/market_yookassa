"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { 
  Monitor, 
  Gamepad2, 
  Music, 
  Video, 
  Image as ImageIcon, 
  Layout, 
  BookOpen, 
  FileText,
  ChevronDown
} from "lucide-react"

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

interface Subcategory {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
}

interface Category {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
  subcategories?: Subcategory[]
}

interface CategoryNavProps {
  categories: Category[]
}

function CategoryMenuItem({ category }: { category: Category }) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const Icon = iconMap[category.icon] || Monitor
  const hasSubcategories = category.subcategories && category.subcategories.length > 0

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      })
    }
  }, [isOpen])

  if (!hasSubcategories) {
    return (
      <Link
        href={`/category/${category.slug}`}
        className="group flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-primary/10 transition-all duration-200 whitespace-nowrap shrink-0"
      >
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
          {category.name}
        </span>
      </Link>
    )
  }

  return (
    <div
      ref={triggerRef}
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Link
        href={`/category/${category.slug}`}
        className="group flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-primary/10 transition-all duration-200 whitespace-nowrap shrink-0"
      >
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
          {category.name}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
      </Link>

      {isOpen && typeof window !== 'undefined' && createPortal(
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="fixed min-w-[200px] bg-background border rounded-lg shadow-lg py-2 z-[10000]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {category.subcategories!.map((subcategory) => {
            const SubIcon = iconMap[subcategory.icon] || Monitor
            return (
              <Link
                key={subcategory.id}
                href={`/category/${subcategory.slug}`}
                className="flex items-center gap-3 px-4 py-2 hover:bg-primary/10 transition-colors"
              >
                <SubIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground hover:text-primary">
                  {subcategory.name}
                </span>
              </Link>
            )
          })}
        </motion.div>,
        document.body
      )}
    </div>
  )
}

export function CategoryNav({ categories }: CategoryNavProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="sticky top-16 z-[9999] border-b bg-secondary/30 backdrop-blur-sm"
    >
      <div className="container mx-auto px-4">
        <div 
          className="flex items-center gap-1 py-3 scrollbar-hide" 
          style={{ overflowX: 'auto', overflowY: 'visible' }}
        >
          {categories.map((category) => (
            <CategoryMenuItem key={category.id} category={category} />
          ))}
        </div>
      </div>
      
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </motion.div>
  )
}
