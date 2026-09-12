import type { NextConfig } from "next";

// Сборка обычная, без `output: 'standalone'`. Площадка ставится через
// install.sh: systemd запускает `next start` из каталога приложения, и
// Next 16 на такое сочетание ругается прямо при старте («"next start"
// does not work with "output: standalone"»). Заодно отпала нужда в
// outputFileTracingExcludes — исключения были нужны только чтобы
// трассировка не копировала загруженные файлы в .next/standalone.
const nextConfig: NextConfig = {
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
