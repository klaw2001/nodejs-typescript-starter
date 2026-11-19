import {
    getIntArray,
    getArrayOrNull,
    getStringOrNull,
    getEnumOrNull,
    getTrueOrFalse
} from '../src/@core/helpers/commonHelpers'
import {
    checkEmail,
    checkMobile,
    checkPassword,
    normalizeMobile,
    validateLogin
} from '../src/@core/helpers/validationHelper'
import dataObjectBuilder from '../src/@core/helpers/dataObjectBuilder'
import { likeIfValue, whereIfFlags, applyIfLimit } from '../src/@core/helpers/prismaHelpers'
import { sniffMime } from '../src/@core/enum/uploadType'

describe('commonHelpers', () => {
    test('getArrayOrNull keeps null for missing values', () => {
        expect(getArrayOrNull(undefined)).toBeNull()
        expect(getArrayOrNull(null)).toBeNull()
        expect(getArrayOrNull(3)).toEqual([3])
    })

    test('getIntArray accepts arrays, JSON and csv', () => {
        expect(getIntArray([1, '2', 'x', 2])).toEqual([1, 2])
        expect(getIntArray('[3,4]')).toEqual([3, 4])
        expect(getIntArray('5,6')).toEqual([5, 6])
        expect(getIntArray(undefined)).toEqual([])
    })

    test('getStringOrNull trims and nulls empty values', () => {
        expect(getStringOrNull('  hi ')).toBe('hi')
        expect(getStringOrNull('   ')).toBeNull()
        expect(getStringOrNull(undefined)).toBeNull()
    })

    test('getEnumOrNull only accepts listed values', () => {
        expect(getEnumOrNull('a', ['a', 'b'])).toBe('a')
        expect(getEnumOrNull('c', { x: 'a', y: 'b' })).toBeNull()
    })

    test('getTrueOrFalse understands common truthy inputs', () => {
        expect([true, 1, '1', 'true', 'TRUE'].every(getTrueOrFalse)).toBe(true)
        expect([false, 0, '0', 'no', undefined].some(getTrueOrFalse)).toBe(false)
    })
})

describe('validationHelper', () => {
    test('emails', () => {
        expect(checkEmail('a@b.co')).toBe(true)
        expect(checkEmail('not an email')).toBe(false)
    })

    test('mobiles are international digit strings', () => {
        expect(normalizeMobile('+1 (415) 555-0123')).toBe('14155550123')
        expect(checkMobile('14155550123')).toBe(true)
        expect(checkMobile('123')).toBe(false)
        expect(checkMobile('+14155550123')).toBe(false)
    })

    test('passwords need 8+ chars with a letter and a digit', () => {
        expect(checkPassword('Passw0rdOK')).toBe(true)
        expect(checkPassword('short1')).toBe(false)
        expect(checkPassword('onlyletters')).toBe(false)
        expect(checkPassword('12345678')).toBe(false)
    })

    test('login body needs identifier and password', () => {
        expect(validateLogin({ identifier: 'a@b.co', password: 'x' })).toBe(true)
        expect(validateLogin({ identifier: ' ', password: 'x' })).toBe(false)
        expect(validateLogin({ identifier: 'a@b.co', password: '' })).toBe(false)
    })
})

describe('dataObjectBuilder', () => {
    test('only copies keys present in the body and applies the filter', () => {
        const data = dataObjectBuilder({ name: '  Ann ', skip: 1 })
            .addIfValueExists('name', getStringOrNull)
            .addIfValueExists('missing')
            .getDataObject()

        expect(data).toEqual({ name: 'Ann' })
    })
})

describe('prismaHelpers', () => {
    test('whereIfFlags hides deleted rows unless asked', () => {
        const options: any = {}
        whereIfFlags(options, 'user', { status: '1' })

        expect(options.where).toEqual({ user_status: true, user_deleted: false })
    })

    test('likeIfValue builds a case insensitive OR', () => {
        const options: any = {}
        likeIfValue(options, ['user_email'], 'ann')

        expect(options.where.AND[0].OR).toEqual([{ user_email: { contains: 'ann', mode: 'insensitive' } }])
    })

    test('applyIfLimit caps page size', () => {
        const options: any = {}
        applyIfLimit(options, '99999')

        expect(options.take).toBe(1000)
    })
})

describe('sniffMime', () => {
    test('detects allowed upload types from file content', () => {
        expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
        expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('image/png')
        expect(sniffMime(Buffer.from('RIFF0000WEBPVP8 '))).toBe('image/webp')
        expect(sniffMime(Buffer.from('%PDF-1.7'))).toBe('application/pdf')
    })

    test('rejects everything else', () => {
        expect(sniffMime(Buffer.from('<?php echo 1; ?>'))).toBeNull()
        expect(sniffMime(Buffer.alloc(0))).toBeNull()
    })
})
