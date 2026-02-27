import { Construction } from "lucide-react"
import { Card } from "@/components/ui/card"

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
        
        <p className="text-sm text-muted-foreground">
          Пожалуйста, попробуйте зайти позже. Приносим извинения за неудобства.
        </p>
      </Card>
    </div>
  )
}
