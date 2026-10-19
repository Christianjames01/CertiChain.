export const MAX_CERTIFICATE_MB = 15

export async function fileFingerprint(file) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const shortFingerprint = (hex) => (hex ? `${hex.slice(0, 10)}…${hex.slice(-8)}` : '')

export const fileSizeText = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
