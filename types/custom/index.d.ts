import type { AuthUser } from '../../src/@core/types/auth'

declare global {
    namespace Express {
        interface Request {
            userInfo?: AuthUser
            // Raw request body, kept for webhook signature verification
            rawBody?: Buffer
        }
    }
}

export {}
