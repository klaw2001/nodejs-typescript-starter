const uploadType = {
    IMAGE: 'image',
    DOCUMENT: 'document'
}

export const UPLOAD_MIME_TYPES: Record<string, string[]> = {
    [uploadType.IMAGE]: ['image/jpeg', 'image/png', 'image/webp'],
    [uploadType.DOCUMENT]: ['application/pdf']
}

export default uploadType

// Content based check: the mimetype sent by the client is not trusted on its own
export function sniffMime(buffer: Buffer): string | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg'
    }
    if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
        return 'image/png'
    }
    if (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return 'image/webp'
    }
    if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
        return 'application/pdf'
    }
    return null
}
