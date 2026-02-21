import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен" },
        { status: 403 }
      )
    }

    const sellers = await prisma.user.findMany({
      where: {
        OR: [
          { role: "SELLER" },
          { role: "ADMIN" }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        balance: true,
        verified: true,
        createdAt: true,
        _count: {
          select: {
            products: true,
            purchases: {
              where: {
                product: {
                  sellerId: { not: undefined }
                }
              }
            }
          }
        },
        products: {
          select: {
            id: true,
            title: true,
            status: true,
            price: true,
            reviews: {
              select: {
                rating: true
              }
            },
            _count: {
              select: {
                purchases: {
                  where: {
                    status: "COMPLETED"
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    // Calculate additional statistics for each seller
    const sellersWithStats = sellers.map(seller => {
      const activeProducts = seller.products.filter(p => p.status === "ACTIVE").length
      const totalSales = seller.products.reduce((sum, p) => sum + p._count.purchases, 0)
      const totalRevenue = seller.products.reduce((sum, p) => sum + (p.price * p._count.purchases), 0)
      
      const allReviews = seller.products.flatMap(p => p.reviews)
      const avgRating = allReviews.length > 0
        ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1)
        : 0

      return {
        ...seller,
        stats: {
          activeProducts,
          totalProducts: seller._count.products,
          totalSales,
          totalRevenue,
          avgRating: parseFloat(avgRating as string),
          totalReviews: allReviews.length
        }
      }
    })

    return NextResponse.json({ success: true, data: sellersWithStats })
  } catch (error) {
    console.error("Error fetching sellers:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при получении данных о магазинах" },
      { status: 500 }
    )
  }
}
