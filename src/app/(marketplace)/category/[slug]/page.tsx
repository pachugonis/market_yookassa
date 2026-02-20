import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { CategoryProducts } from "./category-products"

interface Props {
  params: Promise<{ slug: string }>
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params

  const category = await prisma.category.findUnique({
    where: { slug },
  })

  if (!category) {
    notFound()
  }

  const products = await prisma.product.findMany({
    where: { 
      categoryId: category.id,
      status: "ACTIVE" 
    },
    include: {
      seller: { select: { name: true, avatar: true } },
      category: { select: { name: true, slug: true } },
      reviews: { select: { rating: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const productsWithRating = products.map((product) => {
    const avgRating =
      product.reviews.length > 0
        ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
        : 0
    return {
      id: product.id,
      title: product.title,
      price: product.price,
      coverImage: product.coverImage,
      downloadCount: product.downloadCount,
      seller: product.seller,
      category: product.category,
      avgRating,
    }
  })

  return <CategoryProducts category={category} products={productsWithRating} />
}
