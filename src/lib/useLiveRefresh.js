import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

const DEBOUNCE_MS = 700
const POLL_MS = 60_000

let channelSeq = 0

export function useLiveRefresh(tables, refresh) {
    const refreshRef = useRef(refresh)

    useEffect(() => {
        refreshRef.current = refresh
    })

    const tableKey = tables.join(',')

    useEffect(() => {
        let timer = null
        let missedWhileHidden = false

        const isVisible = () => document.visibilityState === 'visible'

        const run = () => {
            if (!isVisible()) {
                missedWhileHidden = true
                return
            }
            refreshRef.current?.({ silent: true })
        }

        const schedule = () => {
            clearTimeout(timer)
            timer = setTimeout(run, DEBOUNCE_MS)
        }

        channelSeq += 1
        const channel = supabase.channel(`live-refresh-${channelSeq}`)
        for (const table of tableKey.split(',')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
        }
        channel.subscribe()

        const onVisibility = () => {
            if (isVisible() && missedWhileHidden) {
                missedWhileHidden = false
                schedule()
            }
        }
        document.addEventListener('visibilitychange', onVisibility)

        const poll = setInterval(() => {
            if (isVisible()) run()
            else missedWhileHidden = true
        }, POLL_MS)

        return () => {
            clearTimeout(timer)
            clearInterval(poll)
            document.removeEventListener('visibilitychange', onVisibility)
            supabase.removeChannel(channel)
        }
    }, [tableKey])
}
