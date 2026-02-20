import { prisma } from "@/lib/prisma"
import { HomePage } from "./home-page"

export default async function Page() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  })

  return <HomePage categories={categories} />
}
