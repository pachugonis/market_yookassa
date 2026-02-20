# 🛍️ DigiMarket - Маркетплейс цифровых товаров

Современная платформа для покупки и продажи цифровых товаров: программ, игр, музыки, графики и многого другого.

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)
![React](https://img.shields.io/badge/React-19.2.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38B2AC)

## ✨ Основные возможности

### Для покупателей
- 🔍 **Поиск и каталог** - удобный поиск товаров с фильтрацией по категориям
- 🛒 **Безопасная оплата** - интеграция с ЮKassa для приема платежей
- 📦 **Библиотека покупок** - доступ ко всем купленным цифровым товарам
- ⬇️ **Загрузка файлов** - защищенная система загрузки с токенами доступа
- ⭐ **Отзывы и рейтинги** - оценивайте товары и оставляйте комментарии

### Для продавцов
- 📊 **Панель управления** - статистика продаж и доходов в реальном времени
- 📤 **Загрузка товаров** - простая система добавления цифровых товаров (до 500MB)
- 💰 **Управление балансом** - отслеживание заработка и вывод средств
- 📈 **Аналитика** - детальная статистика по продажам и скачиваниям
- 🎯 **Категории товаров** - организация товаров по направлениям

### Технические особенности
- 🔐 **Авторизация** - NextAuth v5 с защитой роутов (покупатель/продавец/админ)
- 🎨 **Современный UI** - Radix UI + Tailwind CSS + Framer Motion
- 🌐 **WebGL фон** - красивый анимированный градиент с использованием OGL
- 📱 **Адаптивный дизайн** - отлично работает на всех устройствах
- 🚀 **Производительность** - серверные компоненты Next.js 16 и оптимизация

## 🛠️ Технологический стек

### Frontend
- **Next.js 16** - React фреймворк с App Router
- **React 19** - библиотека для построения интерфейсов
- **TypeScript** - строгая типизация
- **Tailwind CSS 4** - utility-first CSS фреймворк
- **Radix UI** - доступные UI компоненты
- **Framer Motion** - анимации
- **Lucide React** - иконки
- **OGL** - WebGL библиотека для графики
- **Recharts** - графики и диаграммы

### Backend
- **Next.js API Routes** - серверные эндпоинты
- **NextAuth v5** - аутентификация
- **Prisma** - ORM для работы с базой данных
- **PostgreSQL** - реляционная база данных
- **bcryptjs** - хеширование паролей
- **Zod** - валидация данных

### Инструменты разработки
- **ESLint** - линтер кода
- **TypeScript** - компилятор
- **Prisma Studio** - GUI для базы данных
- **tsx** - выполнение TypeScript файлов

## 📋 Предварительные требования

- Node.js 20.x или выше
- PostgreSQL 14.x или выше
- npm или yarn

## 🚀 Установка и запуск

### 1. Клонирование репозитория

```bash
git clone https://github.com/pachugonis/market_yookassa.git
cd market_yookassa
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/market_yookassa"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# YooKassa (опционально для платежей)
YOOKASSA_SHOP_ID="your-shop-id"
YOOKASSA_SECRET_KEY="your-secret-key"
```

### 4. Настройка базы данных

```bash
# Генерация Prisma клиента
npm run db:generate

# Применение схемы к базе данных
npm run db:push

# Заполнение базы тестовыми данными
npm run db:seed
```

### 5. Запуск проекта

```bash
# Режим разработки
npm run dev

# Сборка для production
npm run build

# Запуск production сервера
npm run start
```

Приложение будет доступно по адресу: `http://localhost:3000`

## 📁 Структура проекта

```
market_yookassa/
├── prisma/
│   ├── schema.prisma        # Схема базы данных
│   └── seed.ts              # Тестовые данные
├── public/
│   └── covers/              # Обложки товаров
├── src/
│   ├── app/
│   │   ├── (auth)/          # Страницы авторизации
│   │   ├── (marketplace)/   # Публичные страницы
│   │   ├── (seller)/        # Панель продавца
│   │   ├── api/             # API роуты
│   │   ├── globals.css      # Глобальные стили
│   │   └── layout.tsx       # Корневой лейаут
│   ├── components/
│   │   ├── layout/          # Компоненты лейаута
│   │   ├── products/        # Компоненты товаров
│   │   └── ui/              # UI компоненты
│   ├── hooks/               # React хуки
│   ├── lib/
│   │   ├── auth.ts          # Настройка NextAuth
│   │   ├── prisma.ts        # Prisma клиент
│   │   ├── utils.ts         # Утилиты
│   │   └── yookassa.ts      # Интеграция ЮKassa
│   ├── types/               # TypeScript типы
│   └── middleware.ts        # Next.js middleware
├── uploads/                 # Загруженные файлы
└── package.json
```

## 🗄️ Модель данных

### Основные сущности

- **User** - пользователи (покупатели/продавцы/админы)
- **Product** - цифровые товары
- **Category** - категории товаров
- **Purchase** - покупки
- **Review** - отзывы
- **Payout** - выплаты продавцам
- **DownloadLog** - логи скачиваний

### Роли пользователей

- `BUYER` - покупатель (по умолчанию)
- `SELLER` - продавец (может загружать товары)
- `ADMIN` - администратор (полный доступ)

## 🔑 API Endpoints

### Авторизация
- `POST /api/auth/register` - регистрация
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Товары
- `GET /api/products` - список товаров
- `POST /api/products` - создание товара (продавец)
- `GET /api/products/:id` - детали товара

### Категории
- `GET /api/categories` - список категорий

### Загрузка файлов
- `POST /api/upload` - загрузка файла товара

### Продавец
- `GET /api/seller/stats` - статистика продавца
- `GET /api/seller/products` - товары продавца

## 🎨 UI Компоненты

Проект использует кастомные компоненты на основе Radix UI:

- Button, Input, Select, Dialog
- Dropdown Menu, Tooltip, Toast
- Avatar, Card, Tabs, Separator
- И другие...

Все компоненты находятся в `src/components/ui/`

## 🎯 Скрипты

```bash
# Разработка
npm run dev              # Запуск dev сервера
npm run build            # Сборка проекта
npm run start            # Запуск production сервера
npm run lint             # Проверка кода

# База данных
npm run db:generate      # Генерация Prisma клиента
npm run db:push          # Применение схемы к БД
npm run db:migrate       # Создание миграции
npm run db:seed          # Заполнение тестовыми данными
npm run db:studio        # Запуск Prisma Studio
```

## 🔒 Безопасность

- Хеширование паролей с bcrypt
- JWT сессии через NextAuth
- Защита API роутов middleware
- Валидация данных с Zod
- Защищенные токены для скачивания
- CSRF защита

## 🌐 Интеграция ЮKassa

Проект поддерживает интеграцию с платежной системой ЮKassa:

1. Зарегистрируйтесь на [ЮKassa](https://yookassa.ru/)
2. Получите Shop ID и Secret Key
3. Добавьте их в `.env`
4. Настройте webhook для обработки платежей

## 📝 Лицензия

Этот проект создан в образовательных целях.

## 👥 Автор

Igor Pachugov - [GitHub](https://github.com/pachugonis)

## 🤝 Контрибьюция

Приветствуются любые улучшения! Создавайте Issues и Pull Requests.

---

Сделано с ❤️ используя Next.js и TypeScript
