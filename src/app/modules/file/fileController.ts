import fs from 'fs'
import { Request, Response } from 'express'
import { UploadedFile } from 'express-fileupload'

import { sendResponse } from '@core/services/ResponseService'
import statusType from '@core/enum/statusTypes'
import logger from '@core/services/LoggingService'
import prisma from '@core/helpers/prisma'
import { getEnumOrNull, getIntOrNull, getStringOrNull } from '@core/helpers/commonHelpers'
import uploadType, { UPLOAD_MIME_TYPES, sniffMime } from '@core/enum/uploadType'
import { audit } from '@core/services/AuditService'
import { getSignedFileUrl, resolveFilePath, saveUploadedFile, verifyFileSignature } from '@core/services/StorageService'

// Streams a stored file for a valid, unexpired signed URL (issued by the API to authorised users)
export async function getFile(req: Request, res: Response) {
    try {
        const file_id = getIntOrNull(req.params.file_id)
        const expires = getIntOrNull(req.query.expires)
        const signature = getStringOrNull(req.query.signature)

        if (!file_id || !expires || !signature || !verifyFileSignature(file_id, expires, signature)) {
            return sendResponse(res, false, null, 'Link expired', statusType.FORBIDDEN)
        }

        const file = await prisma.files.findFirst({ where: { file_id, file_deleted: false } })

        if (!file) {
            return sendResponse(res, false, null, 'File not found', statusType.NOT_FOUND)
        }

        const fullPath = resolveFilePath(file.file_key)

        if (!fs.existsSync(fullPath)) {
            return sendResponse(res, false, null, 'File not found', statusType.NOT_FOUND)
        }

        res.setHeader('Content-Type', file.file_mime)
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.file_name)}"`)
        res.setHeader('Cache-Control', 'private, no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

        return fs.createReadStream(fullPath).pipe(res)
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in getFile', error)
        return sendResponse(res, false, null, 'Error getting file', statusType.DB_ERROR)
    }
}

// Multipart upload: field `file` plus optional `type` (image | document, default image).
// Returns the stored file and a signed URL; store `file_id` on your own records.
export async function uploadFile(req: Request, res: Response) {
    try {
        const file = req.files?.file as UploadedFile | UploadedFile[] | undefined
        const type = getEnumOrNull(req.body?.type, uploadType) || uploadType.IMAGE

        if (!file || Array.isArray(file)) {
            return sendResponse(res, false, null, 'Attach one file in the `file` field', statusType.BAD_REQUEST)
        }

        const allowed = UPLOAD_MIME_TYPES[type]
        const detected = sniffMime(file.data)

        // The declared type and the actual content must both be allowed and agree
        if (!allowed.includes(file.mimetype) || detected !== file.mimetype) {
            return sendResponse(res, false, null, `Allowed types: ${allowed.join(', ')}`, statusType.BAD_REQUEST)
        }

        const saved = await saveUploadedFile(file, String(req.userInfo!.user_id))

        await audit(req, 'upload', 'file', saved.file_id, { name: saved.file_name, size: saved.file_size })

        return sendResponse(res, true, { file: saved, url: getSignedFileUrl(saved.file_id) }, 'success')
    } catch (error) {
        logger.consoleErrorLog(req.originalUrl, 'Error in uploadFile', error)
        return sendResponse(res, false, null, 'Error uploading file', statusType.DB_ERROR)
    }
}
