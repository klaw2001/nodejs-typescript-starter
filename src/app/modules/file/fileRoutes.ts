import * as Controller from './fileController'
import authMiddleware from '@/app/middlewares/authMiddleware'
import { route } from '@core/helpers/router'

const router = route()

// Downloads are public but need an expiring signature; uploads need a logged in user
router.post('/upload', authMiddleware, Controller.uploadFile)
router.get('/:file_id', Controller.getFile)

export default router.router
