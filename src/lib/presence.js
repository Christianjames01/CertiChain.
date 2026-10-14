import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const HEARTBEAT_MS = 45_000
const PRESENCE_POLL_MS = 30_000

export function usePresenceHeartbeat(active) {
    useEffect(() => {
        if (!active) return undefined

        const ping = async () => {
            try {
                await supabase.rpc('heartbeat')
            } catch (err) {
                void err
            }
        }

        const goOffline = () => {
            supabase.rpc('go_offline').catch(() => {})
        }

        ping()
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') ping()
        }, HEARTBEAT_MS)

        const onVisible = () => {
            if (document.visibilityState === 'visible') ping()
            else goOffline()
        }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('pagehide', goOffline)

        return () => {
            clearInterval(interval)
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('pagehide', goOffline)
        }
    }, [active])
}

export function useConversationPresence(otherUserId) {
    const [presence, setPresence] = useState(null)

    useEffect(() => {
        if (!otherUserId) {
            setPresence(null)
            return undefined
        }

        let cancelled = false

        const load = async () => {
            try {
                const { data, error } = await supabase.rpc('get_conversation_presence', { p_user_id: otherUserId })
                if (cancelled) return
                if (error) {
                    setPresence(null)
                    return
                }
                const row = Array.isArray(data) ? data[0] : data
                setPresence(row ? { online: !!row.online, lastSeenAt: row.last_seen_at } : null)
            } catch {
                if (!cancelled) setPresence(null)
            }
        }

        load()
        const interval = setInterval(load, PRESENCE_POLL_MS)
        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [otherUserId])

    return presence
}

export function presenceLabel(presence) {
    if (!presence) return null
    if (presence.online) return 'Active now'
    if (!presence.lastSeenAt) return null

    const minutes = Math.floor((Date.now() - new Date(presence.lastSeenAt).getTime()) / 60000)
    if (minutes < 1) return 'Active just now'
    if (minutes < 60) return `Active ${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Active ${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Active yesterday'
    if (days < 7) return `Active ${days}d ago`
    return null
}
