import { useEffect, useState } from 'react'

function storageKey(form, field) {
    return `draft:${form}:${field}`
}

export function useDraftState(form, field, initialValue) {
    const [value, setValue] = useState(() => {
        try {
            const saved = sessionStorage.getItem(storageKey(form, field))
            return saved !== null ? JSON.parse(saved) : initialValue
        } catch {
            return initialValue
        }
    })

    useEffect(() => {
        try {
            sessionStorage.setItem(storageKey(form, field), JSON.stringify(value))
        } catch (err) {
            void err
        }
    }, [form, field, value])

    return [value, setValue]
}

export function clearDraft(form) {
    try {
        const prefix = `draft:${form}:`
        Object.keys(sessionStorage)
            .filter((key) => key.startsWith(prefix))
            .forEach((key) => sessionStorage.removeItem(key))
    } catch (err) {
        void err
    }
}
