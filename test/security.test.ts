import crypto from 'crypto'

import { hashPassword, verifyPassword, encrypt, decrypt, generateOtp } from '../src/@core/securityService/CryptoClient'
import {
    jwtAccessTokenEncode,
    jwtAccessTokenVerify,
    jwtRefreshTokenEncode,
    jwtRefreshTokenVerify,
    jwtResetTokenEncode,
    jwtResetTokenVerify
} from '../src/@core/securityService/JwtClient'
import { getSignedFileUrl, verifyFileSignature } from '../src/@core/services/StorageService'

describe('passwords', () => {
    test('scrypt hashes verify and never match a wrong password', () => {
        const stored = hashPassword('Starter2026')

        expect(stored.startsWith('scrypt$')).toBe(true)
        expect(verifyPassword('Starter2026', stored)).toBe(true)
        expect(verifyPassword('starter2026', stored)).toBe(false)
    })

    test('malformed stored hashes never verify', () => {
        expect(verifyPassword('anything', 'plain-text')).toBe(false)
        expect(verifyPassword('anything', 'scrypt$16384$$')).toBe(false)
    })

    test('OTPs are numeric with the requested length', () => {
        expect(generateOtp()).toMatch(/^\d{6}$/)
        expect(generateOtp(8)).toMatch(/^\d{8}$/)
    })
})

describe('encryption', () => {
    test('round trips with aes-256-cbc', () => {
        process.env.ENCRYPT_KEY = crypto.randomBytes(32).toString('hex')
        process.env.ENCRYPT_IV = crypto.randomBytes(16).toString('hex')

        expect(decrypt(encrypt('secret value'))).toBe('secret value')
    })
})

describe('jwt', () => {
    test('access and refresh tokens carry the payload and use separate secrets', () => {
        const payload = { user_id: 7, token_version: 2 }
        const access = jwtAccessTokenEncode(payload) as string
        const refresh = jwtRefreshTokenEncode(payload) as string

        expect(jwtAccessTokenVerify(access)).toEqual(payload)
        expect(jwtRefreshTokenVerify(refresh)).toEqual(payload)
        expect(jwtAccessTokenVerify(refresh)).toBeNull()
        expect(jwtRefreshTokenVerify(access)).toBeNull()
    })

    test('garbage tokens are rejected', () => {
        expect(jwtAccessTokenVerify('not-a-token')).toBeNull()
    })

    test('reset tokens only verify as reset tokens', () => {
        const reset = jwtResetTokenEncode({ user_id: 3, purpose: 'password_reset' }) as string

        expect(jwtResetTokenVerify(reset)).toEqual({ user_id: 3, purpose: 'password_reset' })
        // An access token must not be accepted as a password reset token
        expect(jwtResetTokenVerify(jwtAccessTokenEncode({ user_id: 3, token_version: 0 }) as string)).toBeNull()
    })
})

describe('signed file urls', () => {
    test('valid signatures verify, tampered or expired ones do not', () => {
        const url = new URL(getSignedFileUrl(5, 60) as string)
        const expires = Number(url.searchParams.get('expires'))
        const signature = url.searchParams.get('signature') as string

        expect(verifyFileSignature(5, expires, signature)).toBe(true)
        expect(verifyFileSignature(6, expires, signature)).toBe(false)
        expect(verifyFileSignature(5, expires, signature.replace(/.$/, '0'))).toBe(false)
        expect(verifyFileSignature(5, 1, signature)).toBe(false)
    })
})
