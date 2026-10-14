import { createRoot } from 'react-dom/client'
import CaptchaPrompt from '../components/CaptchaPrompt'

export function openCaptchaPrompt() {
    return new Promise((resolve) => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const root = createRoot(host)

        const done = (token) => {
            resolve(token)
            setTimeout(() => {
                root.unmount()
                host.remove()
            }, 0)
        }

        root.render(<CaptchaPrompt onDone={done} />)
    })
}
