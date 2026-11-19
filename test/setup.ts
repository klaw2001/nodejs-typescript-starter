// Jest setup: tests must run on a fresh clone and in CI without a .env file or a database.
// Values from a real .env (loaded by dotenv/config before this file) always win.
const defaults: Record<string, string> = {
    MODE: 'development',
    DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/app_test',
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_ACCESS_TOKEN_EXPIRE: '15m',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_REFRESH_TOKEN_EXPIRE: '12h',
    FILE_URL_SECRET: 'test-file-secret',
    API_BASEURL: 'http://localhost:8000/api',
    FRONTEND_BASEURL: 'http://localhost:3000'
}

for (const [key, value] of Object.entries(defaults)) {
    process.env[key] = process.env[key] || value
}
