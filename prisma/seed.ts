// Seeds permission modules, system roles, default permissions and the super admin.
// Run with `npm run db:seed`; `npm run db:seed:demo` also adds a demo user (development only). Safe to run repeatedly.
import { config } from 'dotenv'
import crypto from 'crypto'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../src/generated/prisma/client'

config({ quiet: true })

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

const SEEDER = 'seed'

// Same format as CryptoClient.hashPassword
function hashPassword(plainText: string) {
    const salt = crypto.randomBytes(16).toString('hex')
    const derived = crypto.scryptSync(plainText, salt, 64, { N: 16384 }).toString('hex')

    return `scrypt$16384$${salt}$${derived}`
}

function requireEnv(name: string) {
    const value = process.env[name]

    if (!value || value.startsWith('change-me')) {
        throw new Error(`Set ${name} in .env before seeding`)
    }

    return value
}

// Keep in sync with src/@core/enum/moduleKeys.ts
const modules = [
    { module_key: 'user', module_name: 'Users' },
    { module_key: 'role', module_name: 'Roles & Permissions' },
    { module_key: 'audit', module_name: 'Audit Logs' }
]

// Keep in sync with src/@core/enum/roleKeys.ts
const roles = [
    { role_key: 'super_admin', role_name: 'Super Admin', role_description: 'Full access to everything' },
    { role_key: 'admin', role_name: 'Admin', role_description: 'Manages users and reviews the audit log' },
    { role_key: 'user', role_name: 'User', role_description: 'Regular account without admin permissions' }
]

// role_key -> module_key -> [read, write]. Super admin always gets every module (see seedAccessControl)
const permissions: Record<string, Record<string, [boolean, boolean]>> = {
    admin: {
        user: [true, true],
        role: [true, false],
        audit: [true, false]
    },
    user: {}
}

async function seedAccessControl() {
    for (const module of modules) {
        await prisma.sys_module.upsert({
            where: { module_key: module.module_key },
            create: { ...module, module_created_by: SEEDER },
            update: { module_name: module.module_name }
        })
    }

    for (const role of roles) {
        await prisma.roles.upsert({
            where: { role_key: role.role_key },
            create: { ...role, role_is_system: true, role_created_by: SEEDER },
            update: { role_is_system: true }
        })
    }

    const moduleRows = await prisma.sys_module.findMany()
    const roleRows = await prisma.roles.findMany()

    for (const role of roleRows) {
        if (role.role_key === 'super_admin') {
            // Modules added later are granted automatically so the super admin can never be locked out
            const mapped = await prisma.module_role_map.findMany({ where: { mrm_role_id: role.role_id } })
            const missing = moduleRows.filter((m) => !mapped.some((r) => r.mrm_module_id === m.module_id))

            await prisma.module_role_map.createMany({
                data: missing.map((m) => ({
                    mrm_role_id: role.role_id,
                    mrm_module_id: m.module_id,
                    mrm_read: true,
                    mrm_write: true,
                    mrm_created_by: SEEDER
                }))
            })
            continue
        }

        const rolePermissions = permissions[role.role_key]

        // Only seed defaults once; afterwards permissions are managed through the API
        if (!rolePermissions || (await prisma.module_role_map.count({ where: { mrm_role_id: role.role_id } }))) {
            continue
        }

        await prisma.module_role_map.createMany({
            data: Object.entries(rolePermissions).map(([module_key, [read, write]]) => ({
                mrm_role_id: role.role_id,
                mrm_module_id: moduleRows.find((m) => m.module_key === module_key)!.module_id,
                mrm_read: read || write,
                mrm_write: write,
                mrm_created_by: SEEDER
            }))
        })
    }
}

async function seedSuperAdmin() {
    const role = await prisma.roles.findUniqueOrThrow({ where: { role_key: 'super_admin' } })
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').toLowerCase()

    await prisma.users.upsert({
        where: { user_email: email },
        create: {
            user_first_name: 'Super',
            user_last_name: 'Admin',
            user_email: email,
            user_password: hashPassword(requireEnv('SEED_ADMIN_PASSWORD')),
            user_must_change_password: true,
            user_role_id: role.role_id,
            user_created_by: SEEDER
        },
        update: {}
    })

    console.log(`Super admin: ${email} (must change the password on first login)`)
}

async function seedDemo() {
    if (process.env.MODE === 'production') {
        throw new Error('Demo data cannot be seeded when MODE=production')
    }

    const role = await prisma.roles.findUniqueOrThrow({ where: { role_key: 'user' } })

    await prisma.users.upsert({
        where: { user_email: 'demo@example.com' },
        create: {
            user_first_name: 'Demo',
            user_last_name: 'User',
            user_email: 'demo@example.com',
            user_password: hashPassword(requireEnv('SEED_DEMO_PASSWORD')),
            user_must_change_password: false,
            user_role_id: role.role_id,
            user_created_by: SEEDER
        },
        update: {}
    })

    console.log('Demo user: demo@example.com')
}

async function main() {
    await seedAccessControl()
    await seedSuperAdmin()

    if (process.argv.includes('--demo')) {
        await seedDemo()
    }

    console.log('Seed complete')
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
