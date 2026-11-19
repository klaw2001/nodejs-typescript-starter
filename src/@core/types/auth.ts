import type { roles, users } from '@/generated/prisma/client'

// Authenticated user attached to req.userInfo by authMiddleware
export type AuthUser = Omit<users, 'user_password'> & {
    user_role_relation: roles
}
