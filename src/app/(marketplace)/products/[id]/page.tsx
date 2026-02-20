import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ProductDetail } from "./product-detail"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params
  
  const product = await prisma.product.findUnique({
    where: { id, status: "ACTIVE" },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          _count: { select: { products: true } }
        }
      },
      category: true,
      reviews: {
        include: {
          buyer: { select: { name: true, avatar: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 10
      },
      _count: { select: { reviews: true, purchases: true } },
      licenseKeys: {
        where: { isSold: false },
        select: { id: true }
      }
    }
  })

  if (!product) {
    notFound()
  }

  const avgRating = product.reviews.length > 0
    ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
    : 0

  const availableStock = product.hasLicenseKeys ? product.licenseKeys.length : null

  return <ProductDetail product={product} avgRating={avgRating} availableStock={availableStock} />
}
