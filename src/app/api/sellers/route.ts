import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const sellers = await prisma.user.findMany({
      where: {
        role: {
          in: ["SELLER", "ADMIN"]
        },
        products: {
          some: {
            status: "ACTIVE"
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
        _count: {
          select: {
            products: {
              where: {
                status: "ACTIVE"
              }
            }
          }
        },
        products: {
          where: {
            status: "ACTIVE"
          },
          select: {
            id: true,
            reviews: {
              select: {
                rating: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json(sellers)
  } catch (error) {
    console.error("Failed to fetch sellers:", error)
    return NextResponse.json(
      { error: "Failed to fetch sellers" },
      { status: 500 }
    )
  }
}
