import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

config({ quiet: true })

// `prisma generate` (run by `npm install`) does not connect to the database, so a fresh clone without a
// .env must still install. Commands that do connect (migrate, seed, studio) fail with a clear
// connection error until DATABASE_URL is set.
const databaseUrl = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/app'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts'
    },
    datasource: {
        url: databaseUrl
    }
})
