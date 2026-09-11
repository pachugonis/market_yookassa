import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const categories = [
  { name: "Программы", slug: "software", icon: "Monitor", description: "Программное обеспечение и приложения" },
  { name: "Игры", slug: "games", icon: "Gamepad2", description: "Компьютерные и мобильные игры" },
  { name: "Музыка", slug: "music", icon: "Music", description: "Музыкальные треки и альбомы" },
  { name: "Видео", slug: "video", icon: "Video", description: "Видеоконтент и курсы" },
  { name: "Графика", slug: "graphics", icon: "Image", description: "Изображения, иконки и дизайн" },
  { name: "Шаблоны", slug: "templates", icon: "Layout", description: "Шаблоны сайтов и документов" },
  { name: "Электронные книги", slug: "ebooks", icon: "BookOpen", description: "Книги и учебные материалы" },
  { name: "Документы", slug: "documents", icon: "FileText", description: "Документы и инструкции" },
]

async function main() {
  console.log("Seeding categories...")

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    })
  }

  console.log("Categories seeded successfully!")

  // Администратор с известным паролем годится только для разработки.
  // Установщик его отключает и создаёт администратора через
  // `npm run admin:create` с паролем, который задал владелец.
  if (process.env.SEED_SKIP_ADMIN === "1") {
    return
  }

  // Create admin user
  console.log("Creating admin user...")
  const adminPassword = await bcrypt.hash("admin123", 12)
  
  await prisma.user.upsert({
    where: { email: "admin@market.com" },
    update: {
      role: "ADMIN",
    },
    create: {
      email: "admin@market.com",
      name: "Администратор",
      password: adminPassword,
      role: "ADMIN",
      verified: true,
    },
  })

  console.log("Admin user created successfully!")
  console.log("Email: admin@market.com")
  console.log("Password: admin123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
