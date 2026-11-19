import { Request, Response } from 'express'

import { sendResponse } from '@core/services/ResponseService'
import prisma from '@core/helpers/prisma'
import statusType from '@core/enum/statusTypes'
import logger from '@core/services/LoggingService'
import { getIntOrNull } from '@core/helpers/commonHelpers'
import { likeIfValue, whereIfValue } from '@core/helpers/prismaHelpers'

// Profile of the logged in user plus the permission map the frontend uses to show / hide screens
export async function getUserProfile(req: Request, res: Response) {
    try {
        const { user_id } = req.userInfo!

        const user = await prisma.users.findUniqueOrThrow({
            omit: { user_password: true },
            where: { user_id },
            include: {
                user_role_relation: { select: { role_id: true, role_key: true, role_name: true } }
            }
        })

        const modules = await prisma.sys_module.findMany({
            select: {
                module_key: true,
                module_name: true,
                module_role_map: {
                    select: { mrm_read: true, mrm_write: true },
                    where: { mrm_role_id: user.user_role_id, mrm_status: true, mrm_deleted: false, mrm_archived: false }
                }
            },
            where: { module_status: true, module_deleted: false }
        })

        const access_map = modules.map((m) => ({
            module_key: m.module_key,
            module_name: m.module_name,
            read: m.module_role_map.some((r) => r.mrm_read),
            write: m.module_role_map.some((r) => r.mrm_write)
        }))

        const unread_notifications = await prisma.notifications.count({
            where: { ntf_user_id: user_id, ntf_read_at: null }
        })

        return sendResponse(res, true, { user, access_map, unread_notifications }, 'success')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in getUserProfile', error)
        return sendResponse(res, false, null, 'Error getting profile', statusType.DB_ERROR)
    }
}

// Active users for pickers / dropdowns
export async function getAllUsers(req: Request, res: Response) {
    try {
        const { search, role_id } = req.query

        const options: any = { where: { user_status: true, user_deleted: false } }

        likeIfValue(options, [['user_first_name', 'user_last_name'], 'user_email'], search)
        whereIfValue(options, 'user_role_id', role_id, getIntOrNull)

        const data = await prisma.users.findMany({
            select: {
                user_id: true,
                user_first_name: true,
                user_last_name: true,
                user_email: true,
                user_role_id: true
            },
            ...options,
            orderBy: { user_first_name: 'asc' },
            take: 200
        })

        return sendResponse(res, true, data, 'success')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in getAllUsers', error)
        return sendResponse(res, false, null, 'Error in getting users', statusType.DB_ERROR)
    }
}

export async function getAllActiveRoles(req: Request, res: Response) {
    try {
        const data = await prisma.roles.findMany({
            select: { role_id: true, role_key: true, role_name: true },
            where: { role_status: true, role_deleted: false, role_archived: false },
            orderBy: { role_id: 'asc' }
        })

        return sendResponse(res, true, data, 'success')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in getAllActiveRoles', error)
        return sendResponse(res, false, null, 'Error getting roles', statusType.DB_ERROR)
    }
}

export async function getAllModules(req: Request, res: Response) {
    try {
        const data = await prisma.sys_module.findMany({
            where: { module_status: true, module_archived: false, module_deleted: false },
            orderBy: { module_id: 'asc' }
        })

        return sendResponse(res, true, data, 'success')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in getAllModules', error)
        return sendResponse(res, false, null, 'Error getting modules', statusType.DB_ERROR)
    }
}
