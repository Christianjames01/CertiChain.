import { useEffect, useState } from 'react'
import { generateQrDataUrl, verificationUrl } from '../lib/qrcode'

function SealQr({ code, className }) {
    const [src, setSrc] = useState('')

    useEffect(() => {
        let cancelled = false
        if (code) {
            generateQrDataUrl(verificationUrl(code)).then((url) => {
                if (!cancelled) setSrc(url)
            })
        }
        return () => { cancelled = true }
    }, [code])

    if (!code) return null

    return (
        <div className={className}>
            {src && <img src={src} alt="Scan to verify this document" />}
            <span className="seal-qr-caption">Scan to verify</span>
            <span className="seal-qr-code">{code}</span>
        </div>
    )
}

export default SealQr
