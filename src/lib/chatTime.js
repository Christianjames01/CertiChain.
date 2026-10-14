const sameDay = (a, b) => a.toDateString() === b.toDateString()

export function chatListTime(value) {
    if (!value) return ''
    const d = new Date(value)
    const now = new Date()
    if (sameDay(d, now)) return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    if (now - d < 6 * 24 * 60 * 60 * 1000) return d.toLocaleDateString('en-PH', { weekday: 'short' })
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}

export function dividerLabel(value) {
    const d = new Date(value)
    const now = new Date()
    const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    if (sameDay(d, now)) return `Today ${time}`
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (sameDay(d, yesterday)) return `Yesterday ${time}`
    return `${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })}, ${time}`
}

export function chatBubbleTime(value) {
    return new Date(value).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}
