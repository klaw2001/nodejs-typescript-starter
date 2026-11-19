import cron from 'node-cron'

import prisma from '@core/helpers/prisma'
import logger from '@core/services/LoggingService'

// Example scheduled job: removes expired or used OTP codes and old read notifications.
// Copy this file to add your own jobs, then start them from server.ts.
const NOTIFICATION_RETENTION_DAYS = 90

export async function runCleanup() {
    const now = new Date()
    const notificationCutoff = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const otps = await prisma.otp_codes.deleteMany({
        where: { OR: [{ otp_expires_at: { lt: now } }, { otp_consumed_at: { not: null } }] }
    })

    const notifications = await prisma.notifications.deleteMany({
        where: { ntf_read_at: { not: null, lt: notificationCutoff } }
    })

    logger.consoleInfoLog('cleanupJob', `Removed ${otps.count} OTP codes and ${notifications.count} old notifications`)
}

// CLEANUP_CRON defaults to 03:00 every day; set it to an empty value ("") to disable the job
export function startCleanupJob() {
    const expression = process.env.CLEANUP_CRON ?? '0 3 * * *'

    if (!expression) {
        return null
    }

    if (!cron.validate(expression)) {
        logger.consoleErrorLog('cleanupJob', 'Invalid CLEANUP_CRON, job not started', expression)
        return null
    }

    return cron.schedule(
        expression,
        () => {
            runCleanup().catch((error) => logger.consoleErrorLog('cleanupJob', 'Error in runCleanup', error))
        },
        { timezone: process.env.CLEANUP_TIMEZONE || process.env.TZ || 'UTC' }
    )
}
