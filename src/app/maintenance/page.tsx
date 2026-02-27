import { Construction, Shield } from "lucide-react"
import { Card } from "@/components/ui/card"
import Link from "next/link"

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
      <Card className="max-w-2xl w-full p-8 md:p-12 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/10 p-6 rounded-full">
            <Construction className="h-16 w-16 text-primary" />
          </div>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Технические работы
        </h1>
        
        <p className="text-lg text-muted-foreground mb-6">
          Сайт временно недоступен. Ведутся технические работы.
        </p>
        
        <p className="text-sm text-muted-foreground mb-8">
          Пожалуйста, попробуйте зайти позже. Приносим извинения за неудобства.
        </p>

        <div className="mt-8 pt-8 border-t border-border">
          <Link 
            href="/admin-login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Shield className="h-4 w-4" />
            Вход для администратора
          </Link>
        </div>
      </Card>
    </div>
  )
}
