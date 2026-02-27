import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const settings = await prisma.platformSettings.findFirst()
    
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
