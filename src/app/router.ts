import express from 'express'

import moduleKeys from '@core/enum/moduleKeys'
import authMiddleware from '@/app/middlewares/authMiddleware'
import readAccessMiddleware from '@/app/middlewares/readAccessMiddleware'

import authRoutes from '@/app/modules/auth/authRoutes'
import fileRoutes from '@/app/modules/file/fileRoutes'
import masterRoutes from '@/app/modules/master/masterRoutes'
import notificationRoutes from '@/app/modules/notification/notificationRoutes'
import userRoutes from '@/app/modules/user/userRoutes'
import roleRoutes from '@/app/modules/role/roleRoutes'
import auditRoutes from '@/app/modules/audit/auditRoutes'

const router = express.Router()

// Public: authenticated by credentials or signed URLs
router.use('/auth', authRoutes)
router.use('/file', fileRoutes)

router.use(authMiddleware)

// Every logged in user
router.use('/master', masterRoutes)
router.use('/notification', notificationRoutes)

// Permission based (read access here, write access per route inside the module)
router.use('/user', readAccessMiddleware(moduleKeys.USER), userRoutes)
router.use('/role', readAccessMiddleware(moduleKeys.ROLE), roleRoutes)
router.use('/audit', readAccessMiddleware(moduleKeys.AUDIT), auditRoutes)

export default router
