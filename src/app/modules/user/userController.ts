import { Request, Response } from 'express'

import { notification_type } from '@/generated/prisma/enums'
import { sendResponse } from '@core/services/ResponseService'
import statusType from '@core/enum/statusTypes'
import logger from '@core/services/LoggingService'
import prisma from '@core/helpers/prisma'
import { PASSWORD_RULE_MESSAGE } from '@core/helpers/constant'
import {
    applyIfLimit,
    applyIfOffset,
    checkExists,
    likeIfValue,
    whereIfFlags,
    whereIfValue
} from '@core/helpers/prismaHelpers'
import { getDateOrNull, getIntArray, getIntOrNull, getStringOrNull } from '@core/helpers/commonHelpers'
import { checkEmail, checkMobile, checkPassword, normalizeMobile } from '@core/helpers/validationHelper'
import { generateOtp, hashPassword, randomToken } from '@core/securityService/CryptoClient'
import dataObjectBuilder from '@core/helpers/dataObjectBuilder'
import { audit } from '@core/services/AuditService'
import { notifyUsers } from '@core/services/NotificationService'

const userInclude = {
    user_role_relation: { select: { role_id: true, role_name: true, role_key: true } }
}

// Readable temporary password, e.g. "kq7mx4x2-481927"
function temporaryPassword() {
    return `${randomToken(4)}-${generateOtp(6)}`
}

export async function getAllUsers(req: Request, res: Response) {
    try {
        const { search, status, archived, deleted, limit, offset, role_id } = req.query

        const options: any = {}

        whereIfFlags(options, 'user', { status, archived, deleted })
        whereIfValue(options, 'user_role_id', role_id, getIntOrNull)

        likeIfValue(options, [['user_first_name', 'user_last_name'], 'user_mobile', 'user_email'], search)

        const count = await prisma.users.count(options)

        applyIfLimit(options, limit)

        applyIfOffset(options, offset)

        const users = await prisma.users.findMany({
            omit: { user_password: true },
            include: userInclude,
            orderBy: { user_created_at: 'desc' },
            ...options
        })

        return sendResponse(res, true, { total: count, rows: users }, 'success')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in getAllUsers', error)
        return sendResponse(res, false, null, 'Error in getting all users', statusType.DB_ERROR)
    }
}

export async function getSingleUser(req: Request, res: Response) {
    try {
        const user_id = getIntOrNull(req.params.user_id)

        if (!user_id) {
            return sendResponse(res, false, null, 'user_id not valid', statusType.BAD_REQUEST)
        }

        const data = await prisma.users.findFirst({
            omit: { user_password: true },
            where: { user_id, user_deleted: false },
            include: userInclude
        })

        if (!data) {
            return sendResponse(res, false, null, 'User not found', statusType.NOT_FOUND)
        }

        return sendResponse(res, true, data, 'success')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in getSingleUser', error)
        return sendResponse(res, false, null, 'Error getting single user', statusType.DB_ERROR)
    }
}

// Creates (no user_id) or updates (user_id) a user. A new user gets a temporary password that must be
// changed on first login; it is returned once so an administrator can hand it over.
export async function saveUser(req: Request, res: Response) {
    try {
        const viewer = req.userInfo!
        const user_id = getIntOrNull(req.body.user_id)

        const data: any = dataObjectBuilder(req.body)
            .addIfValueExists('user_first_name', getStringOrNull)
            .addIfValueExists('user_last_name', getStringOrNull)
            .addIfValueExists('user_email', (val) => getStringOrNull(val)?.toLowerCase() || null)
            .addIfValueExists('user_mobile', normalizeMobile)
            .addIfValueExists('user_role_id', getIntOrNull)
            .addIfValueExists('user_access_expires_at', getDateOrNull)
            .getDataObject()

        if (data.user_email !== undefined && !checkEmail(data.user_email)) {
            return sendResponse(res, false, null, 'Enter a valid email', statusType.BAD_REQUEST)
        }

        if (data.user_mobile && !checkMobile(data.user_mobile)) {
            return sendResponse(
                res,
                false,
                null,
                'Enter a valid mobile number with country code',
                statusType.BAD_REQUEST
            )
        }

        if (user_id === viewer.user_id && data.user_role_id && data.user_role_id !== viewer.user_role_id) {
            return sendResponse(res, false, null, 'You cannot change your own role', statusType.FORBIDDEN)
        }

        if (data.user_role_id) {
            const role = await prisma.roles.findFirst({ where: { role_id: data.user_role_id, role_deleted: false } })

            if (!role || !role.role_status) {
                return sendResponse(res, false, null, 'Role not found', statusType.BAD_REQUEST)
            }
        }

        const exists = await checkExists(
            'users',
            'user',
            user_id,
            ['user_mobile', 'user_email'],
            [data.user_mobile, data.user_email]
        )

        if (exists.data) {
            return sendResponse(res, false, null, exists.message, statusType.CONFLICT)
        }

        const password = getStringOrNull(req.body.user_password)

        if (password && !checkPassword(password)) {
            return sendResponse(res, false, null, PASSWORD_RULE_MESSAGE, statusType.BAD_REQUEST)
        }

        let temp_password: string | null = null
        let saved_user_id: number

        if (user_id) {
            const existing = await prisma.users.findFirst({ where: { user_id, user_deleted: false } })

            if (!existing) {
                return sendResponse(res, false, null, 'User not found', statusType.NOT_FOUND)
            }

            data.user_updated_by = String(viewer.user_id)

            await prisma.users.update({ where: { user_id }, data })

            // A role change takes effect immediately instead of when the token expires
            if (data.user_role_id && data.user_role_id !== existing.user_role_id) {
                await prisma.users.update({ where: { user_id }, data: { user_token_version: { increment: 1 } } })
            }

            saved_user_id = user_id
        } else {
            if (!data.user_first_name || !data.user_last_name || !data.user_email || !data.user_role_id) {
                return sendResponse(
                    res,
                    false,
                    null,
                    'First name, last name, email and role are required',
                    statusType.BAD_REQUEST
                )
            }

            temp_password = password ? null : temporaryPassword()

            const created = await prisma.users.create({
                data: {
                    ...data,
                    user_password: hashPassword(password || (temp_password as string)),
                    user_must_change_password: true,
                    user_created_by: String(viewer.user_id)
                }
            })

            await notifyUsers([created.user_id], {
                type: notification_type.account,
                title: 'Welcome',
                message: 'Your account has been created. Please change your temporary password on first login.'
            })

            saved_user_id = created.user_id
        }

        await audit(req, user_id ? 'update' : 'create', 'user', saved_user_id, { fields: Object.keys(data) })

        return sendResponse(res, true, { user_id: saved_user_id, temp_password }, 'success')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in saveUser', error)
        return sendResponse(res, false, null, 'Error saving user', statusType.DB_ERROR)
    }
}

// Removes access immediately: every issued token stops working on the next request
export async function deactivateUser(req: Request, res: Response) {
    try {
        const viewer = req.userInfo!
        const user_id = getIntOrNull(req.body.user_id)

        if (!user_id) {
            return sendResponse(res, false, null, 'user_id is required', statusType.BAD_REQUEST)
        }

        if (user_id === viewer.user_id) {
            return sendResponse(res, false, null, 'You cannot deactivate yourself', statusType.BAD_REQUEST)
        }

        const user = await prisma.users.findFirst({ where: { user_id, user_deleted: false } })

        if (!user) {
            return sendResponse(res, false, null, 'User not found', statusType.NOT_FOUND)
        }

        const reason = getStringOrNull(req.body.reason)

        await prisma.users.update({
            where: { user_id },
            data: {
                user_status: false,
                user_deactivated_at: new Date(),
                user_deactivation_reason: reason,
                user_token_version: { increment: 1 },
                user_updated_by: String(viewer.user_id)
            }
        })

        await audit(req, 'deactivate', 'user', user_id, { reason })

        return sendResponse(res, true, null, 'Access removed')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in deactivateUser', error)
        return sendResponse(res, false, null, 'Error deactivating user', statusType.DB_ERROR)
    }
}

export async function reactivateUser(req: Request, res: Response) {
    try {
        const user_id = getIntOrNull(req.body.user_id)

        if (!user_id) {
            return sendResponse(res, false, null, 'user_id is required', statusType.BAD_REQUEST)
        }

        const user = await prisma.users.findFirst({ where: { user_id, user_deleted: false } })

        if (!user) {
            return sendResponse(res, false, null, 'User not found', statusType.NOT_FOUND)
        }

        await prisma.users.update({
            where: { user_id },
            data: {
                user_status: true,
                user_deactivated_at: null,
                user_deactivation_reason: null,
                user_failed_login_count: 0,
                user_locked_until: null,
                user_updated_by: String(req.userInfo!.user_id)
            }
        })

        await audit(req, 'reactivate', 'user', user_id)

        return sendResponse(res, true, null, 'Access restored')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in reactivateUser', error)
        return sendResponse(res, false, null, 'Error reactivating user', statusType.DB_ERROR)
    }
}

export async function forceLogout(req: Request, res: Response) {
    try {
        const user_ids = getIntArray(req.body.user_ids ?? req.body.user_id)

        if (!user_ids.length) {
            return sendResponse(res, false, null, 'user_ids is required', statusType.BAD_REQUEST)
        }

        const users = await prisma.users.findMany({
            select: { user_id: true },
            where: { user_id: { in: user_ids }, user_deleted: false }
        })

        if (!users.length) {
            return sendResponse(res, false, null, 'User not found', statusType.NOT_FOUND)
        }

        await prisma.users.updateMany({
            where: { user_id: { in: users.map((u) => u.user_id) } },
            data: { user_token_version: { increment: 1 } }
        })

        for (const { user_id } of users) {
            await audit(req, 'force_logout', 'user', user_id)
        }

        return sendResponse(res, true, { count: users.length }, 'Sessions ended')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in forceLogout', error)
        return sendResponse(res, false, null, 'Error ending sessions', statusType.DB_ERROR)
    }
}

export async function resetUserPassword(req: Request, res: Response) {
    try {
        const user_id = getIntOrNull(req.body.user_id)

        if (!user_id) {
            return sendResponse(res, false, null, 'user_id is required', statusType.BAD_REQUEST)
        }

        const user = await prisma.users.findFirst({ where: { user_id, user_deleted: false } })

        if (!user) {
            return sendResponse(res, false, null, 'User not found', statusType.NOT_FOUND)
        }

        const password = getStringOrNull(req.body.password)

        if (password && !checkPassword(password)) {
            return sendResponse(res, false, null, PASSWORD_RULE_MESSAGE, statusType.BAD_REQUEST)
        }

        const temp_password = password ? null : temporaryPassword()

        await prisma.users.update({
            where: { user_id },
            data: {
                user_password: hashPassword(password || (temp_password as string)),
                user_must_change_password: true,
                user_failed_login_count: 0,
                user_locked_until: null,
                user_token_version: { increment: 1 },
                user_updated_by: String(req.userInfo!.user_id)
            }
        })

        await audit(req, 'reset_password', 'user', user_id)

        return sendResponse(res, true, { temp_password }, 'Password reset')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in resetUserPassword', error)
        return sendResponse(res, false, null, 'Error resetting password', statusType.DB_ERROR)
    }
}
