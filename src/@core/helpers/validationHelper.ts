import { PASSWORD_REGEX } from './constant'

export const checkEmail = (email: any) => {
    return typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email)
}

// International numbers, digits only with country code (E.164 allows 8-15 digits), e.g. 14155550123
export const checkMobile = (mobile: any) => {
    return typeof mobile === 'string' && /^[1-9]\d{7,14}$/.test(mobile)
}

export const checkPassword = (password: any) => {
    return typeof password === 'string' && PASSWORD_REGEX.test(password)
}

// Strips spaces, dashes, brackets and a leading + so numbers compare consistently
export const normalizeMobile = (mobile: any) => {
    if (typeof mobile !== 'string' && typeof mobile !== 'number') {
        return null
    }

    const digits = mobile.toString().replace(/\D/g, '')
    return digits || null
}

// Login identifier can be an e-mail or a mobile number
export const validateLogin = (body: any) => {
    const isIdentifier = typeof body.identifier === 'string' && body.identifier.trim().length > 0
    const isPassword = typeof body.password === 'string' && body.password.length > 0 && body.password.length <= 64

    return isIdentifier && isPassword
}
