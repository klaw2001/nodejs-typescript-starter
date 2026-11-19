declare global {
    namespace NodeJS {
        interface ProcessEnv {
            TZ: string
            MODE: 'development' | 'staging' | 'production'
            NODE_ENV?: string
            PORT?: string
            API_BASEURL?: string
            FRONTEND_BASEURL?: string
            CORS_ORIGINS?: string

            DATABASE_URL: string

            JWT_ACCESS_SECRET: string
            JWT_ACCESS_TOKEN_EXPIRE: string
            JWT_REFRESH_SECRET: string
            JWT_REFRESH_TOKEN_EXPIRE: string
            LOGIN_MAX_ATTEMPTS?: string
            LOGIN_LOCK_MINUTES?: string
            OTP_EXPIRE_MINUTES?: string

            ENCRYPT_KEY: string
            ENCRYPT_IV: string
            FILE_URL_SECRET: string

            STORAGE_PATH?: string
            UPLOAD_MAX_MB?: string

            MAIL_HOST?: string
            MAIL_PORT?: string
            MAIL_SECURE?: string
            MAIL_USER?: string
            MAIL_PASSWORD?: string
            MAIL_FROM?: string

            SMS_PROVIDER?: 'console'

            CLEANUP_CRON?: string
            CLEANUP_TIMEZONE?: string
        }
    }
}

export {}
