import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Загруженные пользователями файлы — данные, а не код: маршруты читают
  // их с диска во время работы. Без исключения трассировка копирует их
  // в .next/standalone при каждой сборке, и на сервере с файлами товаров
  // это удваивает занятое место.
  outputFileTracingExcludes: {
    '/**/*': [
      './uploads/**/*',
      './public/avatars/**/*',
      './public/covers/**/*',
      './public/category-icons/**/*',
    ],
  },
  images: {
    // images.domains устарел в Next 16 — remotePatterns задаёт то же самое,
    // но с явным протоколом.
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

export default nextConfig;
