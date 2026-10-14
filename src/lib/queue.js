import { isClosedWeekday } from './officeCalendar'
import { supabase } from './supabase'

export function todayStr() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const QUEUE_DAY_LETTERS = ['Q', 'A', 'B', 'C', 'D', 'E', 'F']

export function formatQueueNumber(n) {
    const letter = QUEUE_DAY_LETTERS[new Date().getDay()]
    return `${letter}-${String(n).padStart(3, '0')}`
}

export async function isOfficeOpenToday() {
    const today = todayStr()
    const isWeekend = isClosedWeekday(new Date().getDay())

    const { data: closedAnnouncement } = await supabase
        .from('announcements')
        .select('announcement_id')
        .eq('announcement_date', today)
        .eq('is_closed', true)
        .eq('is_active', true)
        .maybeSingle()

    if (closedAnnouncement) return false

    if (!isWeekend) return true

    const { data: openDay } = await supabase
        .from('office_open_days')
        .select('open_day_id')
        .eq('open_date', today)
        .maybeSingle()

    return !!openDay
}

export async function createQueueTicket({ studentId, requestId, visitorName, purpose } = {}) {
    const today = todayStr()

    const { data: queueNumber, error: numberError } = await supabase.rpc('next_queue_number', { p_date: today })
    if (numberError) throw new Error('Failed to reserve a queue number: ' + numberError.message)

    const { data, error: insertError } = await supabase
        .from('walk_in_queue')
        .insert({
            queue_date: today,
            queue_number: queueNumber,
            student_id: studentId || null,
            request_id: requestId || null,
            visitor_name: visitorName?.trim() || null,
            purpose: purpose?.trim() || null,
        })
        .select()
        .single()

    if (insertError) throw new Error('Failed to create the queue ticket: ' + insertError.message)

    return data
}

export async function createQueueTicketBatch(count) {
    const today = todayStr()

    const { data: numbers, error: numberError } = await supabase.rpc('reserve_queue_numbers', {
        p_date: today,
        p_count: count,
    })
    if (numberError) throw new Error('Failed to reserve queue numbers: ' + numberError.message)

    const rows = (numbers || []).map((queue_number) => ({
        queue_date: today,
        queue_number,
    }))

    const { data, error: insertError } = await supabase
        .from('walk_in_queue')
        .insert(rows)
        .select()

    if (insertError) throw new Error('Failed to create the queue tickets: ' + insertError.message)

    return (data || []).sort((a, b) => a.queue_number - b.queue_number)
}
