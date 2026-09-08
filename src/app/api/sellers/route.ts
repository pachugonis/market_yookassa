import { NextResponse } from "next/server"
import { getCatalogSellers } from "@/lib/catalog"

export async function GET() {
  try {
    const sellers = await getCatalogSellers()

    return NextResponse.json(sellers)
  } catch (error) {
    console.error("Failed to fetch sellers:", error)
    return NextResponse.json(
      { error: "Failed to fetch sellers" },
      { status: 500 }
    )
  }
}
