// Permission modules (sys_module.module_key) checked by the read/write access middlewares.
// Add a key here, add it to `modules` in prisma/seed.ts and guard the route with
// readAccessMiddleware(moduleKeys.X) / writeAccessMiddleware(moduleKeys.X).
const moduleKeys = {
    USER: 'user',
    ROLE: 'role',
    AUDIT: 'audit'
}

export default moduleKeys
