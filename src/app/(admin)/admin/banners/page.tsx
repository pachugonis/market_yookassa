import { prisma } from "@/lib/prisma"
import { BannerManager } from "@/components/admin/banner-manager"

export default async function BannersPage() {
  const banners = await prisma.banner.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      imageUrl: true,
      mobileImageUrl: true,
      title: true,
      link: true,
      isActive: true,
    },
  })

  return <BannerManager banners={banners} />
}
