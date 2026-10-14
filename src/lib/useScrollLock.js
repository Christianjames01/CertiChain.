import { useEffect } from 'react'

let lockCount = 0
let saved = null

export function useScrollLock(active = true) {
    useEffect(() => {
        if (!active) return undefined

        const { body } = document

        if (lockCount === 0) {
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
            saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
            body.style.overflow = 'hidden'
            if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
        }
        lockCount += 1

        return () => {
            lockCount -= 1
            if (lockCount === 0 && saved) {
                body.style.overflow = saved.overflow
                body.style.paddingRight = saved.paddingRight
                saved = null
            }
        }
    }, [active])
}
