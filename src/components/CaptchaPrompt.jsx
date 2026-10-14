import { useEffect, useRef } from 'react'
import CaptchaCheck from './CaptchaCheck'
import './CaptchaCheck.css'

function CaptchaPrompt({ onDone }) {
    const doneRef = useRef(false)

    const finish = (token) => {
        if (doneRef.current) return
        doneRef.current = true
        onDone(token)
    }

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') finish(null)
        }
        document.addEventListener('keydown', onKey)
        const { overflow } = document.body.style
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = overflow
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="captcha-prompt-backdrop" onMouseDown={(e) => e.target === e.currentTarget && finish(null)}>
            <div className="captcha-prompt" role="dialog" aria-modal="true" aria-label="Security check">
                <button type="button" className="captcha-prompt-close" onClick={() => finish(null)} aria-label="Cancel">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
                <CaptchaCheck
                    onToken={(token) => {
                        if (token) setTimeout(() => finish(token), 700)
                    }}
                />
            </div>
        </div>
    )
}

export default CaptchaPrompt
