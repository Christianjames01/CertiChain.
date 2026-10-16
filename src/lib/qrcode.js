import QRCode from 'qrcode'

const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://zdn7u-5yaaa-aaaai-ayclq-cai.icp0.io').replace(/\/+$/, '')

export function verificationUrl(credentialNumber) {
    return `${PUBLIC_SITE_URL}/verify/${encodeURIComponent(credentialNumber)}`
}

export async function generateQrDataUrl(text) {
    return QRCode.toDataURL(text, {
        width: 220,
        margin: 1,
        color: { dark: '#101827', light: '#ffffff' },
    })
}
