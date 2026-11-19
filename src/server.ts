import '@core/helpers/env'

import http from 'http'

import app from '@/app'
import prisma from '@core/helpers/prisma'
import logger from '@core/services/LoggingService'
import { startCleanupJob } from '@/app/jobs/cleanupJob'

const server = http.createServer(app)
let cleanupJob: ReturnType<typeof startCleanupJob> = null

const port = app.get('port')

server.listen(port, '0.0.0.0')

const onError = (error: any) => {
    if (error.syscall !== 'listen') {
        throw error
    }
    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(`Port ${port} requires elevated privileges`)
            process.exit(1)
            break
        case 'EADDRINUSE':
            console.error(`Port ${port} is already in use`)
            process.exit(1)
            break
        default:
            throw error
    }
}

const onListening = () => {
    const addr = server.address()
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + port
    logger.consoleInfoLog('server', 'Server Listening on ' + bind)
    cleanupJob = startCleanupJob()
}

const shutdown = async () => {
    cleanupJob?.stop()
    server.close()
    await prisma.$disconnect()
    process.exit(0)
}

server.on('error', onError)
server.on('listening', onListening)

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
