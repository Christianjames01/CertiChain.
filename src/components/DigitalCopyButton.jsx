import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { downloadDigitalCopy } from '../lib/digitalCopy'

function DigitalCopyButton({ credentialId, credentialNumber, status, className = 'student-primary-button' }) {
    const [copy, setCopy] = useState(null)
    const [checked, setChecked] = useState(false)

    useEffect(() => {
        let alive = true
        supabase
            .from('credentials')
            .select('digital_file_path, digital_seal_code')
            .eq('credential_id', credentialId)
            .maybeSingle()
            .then(({ data }) => {
                if (!alive) return
                setCopy(data?.digital_file_path ? data : null)
                setChecked(true)
            })
        return () => { alive = false }
    }, [credentialId])

    if (!checked || status === 'revoked') return null
    if (!copy) {
        return <p style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 10 }}>Your digital copy (PDF) is being prepared and sealed on the blockchain. It appears here within a minute or two.</p>
    }
    return (
        <div style={{ marginTop: 12 }}>
            <button type="button" className={className} onClick={() => downloadDigitalCopy(copy.digital_file_path, credentialNumber)}>
                Download digital copy (PDF)
            </button>
            <p style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 6 }}>
                This PDF is sealed on the Internet Computer blockchain ({copy.digital_seal_code}). Anyone can upload it on the verify page to confirm it is genuine. Send the file as it is, because editing or re-saving it makes it fail verification.
            </p>
        </div>
    )
}

export default DigitalCopyButton
