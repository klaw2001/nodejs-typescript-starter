import request from 'supertest'

import app from '../src/app'

// Guard tests: they never reach the database, so they run without Postgres.
describe('API guards', () => {
    test('health check', async () => {
        const response = await request(app).get('/health')

        expect(response.status).toBe(200)
        expect(response.body.status).toBe('ok')
    })

    test('unknown routes return the standard 404 body', async () => {
        const response = await request(app).get('/unknown')

        expect(response.status).toBe(404)
        expect(response.body.status).toBe(false)
    })

    test('protected routes need a token', async () => {
        const response = await request(app).get('/api/user/all')

        expect(response.status).toBe(401)
        expect(response.body.data.code).toBe('TOKEN_MISSING')
    })

    test('invalid tokens are rejected', async () => {
        const response = await request(app).get('/api/master/user-profile').set('Authorization', 'Bearer not-a-token')

        expect(response.status).toBe(401)
        expect(response.body.data.code).toBe('TOKEN_INVALID')
    })

    test('login validates the body', async () => {
        const response = await request(app).post('/api/auth/login').send({ identifier: '', password: '' })

        expect(response.status).toBe(400)
    })

    test('refresh needs a refresh token', async () => {
        const response = await request(app).post('/api/auth/access-token').send({})

        expect(response.status).toBe(400)
    })

    test('file links need a valid signature', async () => {
        const response = await request(app).get('/api/file/1?expires=1&signature=abc')

        expect(response.status).toBe(403)
    })

    test('malformed JSON gets a 400, not a stack trace', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"identifier":')

        expect(response.status).toBe(400)
        expect(response.body.message).toBe('Invalid JSON body')
    })

    test('security headers are set and x-powered-by is hidden', async () => {
        const response = await request(app).get('/health')

        expect(response.headers['x-powered-by']).toBeUndefined()
        expect(response.headers['x-content-type-options']).toBe('nosniff')
    })
})
