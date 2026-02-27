import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const settings = await prisma.platformSettings.findFirst({
      select: {
        maintenanceMode: true,
        maintenanceMessage: true
      }
    })
    
    return NextResponse.json({ 
      maintenanceMode: settings?.maintenanceMode ?? false,
      maintenanceMessage: settings?.maintenanceMessage ?? "Сайт временно недоступен. Ведутся технические работы."
    })
  } catch (error) {
    console.error("Error checking maintenance status:", error)
    return NextResponse.json({ 
      maintenanceMode: false,
      maintenanceMessage: ""
    })
  }
}
