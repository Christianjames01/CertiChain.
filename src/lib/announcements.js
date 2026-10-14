import { supabase } from './supabase'

export async function fetchActiveAnnouncements(audienceFlag) {
    const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .eq(audienceFlag, true)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('FETCH ANNOUNCEMENTS ERROR:', error)
        return []
    }

    return data || []
}

export function formatAnnouncementDate(dateStr, { withYear = false } = {}) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        ...(withYear ? { year: 'numeric' } : {}),
    })
}

export function announcementTone(a) {
    if (!a.announcement_date) return 'general'
    return a.is_closed ? 'closed' : 'open'
}
