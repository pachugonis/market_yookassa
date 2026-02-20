import { UserRole } from "@prisma/client"
import "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface User {
    id: string
    role: UserRole
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
  }
}

export type { UserRole }

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface ProductWithSeller {
  id: string
  title: string
  description: string
  price: number
  coverImage: string | null
  status: string
  downloadCount: number
  createdAt: Date
  seller: {
    id: string
    name: string
    avatar: string | null
  }
  category: {
    id: string
    name: string
    slug: string
  }
  _count?: {
    reviews: number
    purchases: number
  }
  avgRating?: number
}

export interface PurchaseWithProduct {
  id: string
  amount: number
  status: string
  downloadToken: string | null
  downloadCount: number
  downloadExpiresAt: Date | null
  createdAt: Date
  product: {
    id: string
    title: string
    coverImage: string | null
    fileName: string
    fileSize: number
  }
}

export interface SellerStats {
  totalSales: number
  totalEarnings: number
  totalProducts: number
  pendingBalance: number
}
