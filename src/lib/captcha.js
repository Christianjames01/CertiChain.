export const TURNSTILE_SITE_KEY = '0x4AAAAAAEk6wBO7GnQDBJCw'
export const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)

let scriptPromise = null

export function loadTurnstile() {
    if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
    if (window.turnstile) return Promise.resolve(window.turnstile)

    scriptPromise ||= new Promise((resolve, reject) => {
        const script = document.createElement('script')
        let settled = false
        const fail = () => {
            if (settled) return
            settled = true
            scriptPromise = null
            script.remove()
            reject(new Error('The security check could not load. Check your connection, or turn off any ad blocker or privacy shield for this site, then try again.'))
        }
        const timer = setTimeout(fail, 15000)
        window.__certichainTurnstileReady = () => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(window.turnstile)
        }
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__certichainTurnstileReady'
        script.async = true
        script.onerror = () => {
            clearTimeout(timer)
            fail()
        }
        document.head.appendChild(script)
    })

    return scriptPromise
}

export function preloadCaptcha() {
    if (!captchaEnabled || typeof window === 'undefined') return
    loadTurnstile().catch(() => {  })
    import('./captchaPrompt.jsx').catch(() => {  })
}

export async function getCaptchaToken() {
    if (!captchaEnabled) return undefined
    const { openCaptchaPrompt } = await import('./captchaPrompt.jsx')
    return openCaptchaPrompt()
}
