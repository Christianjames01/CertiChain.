import { supabase } from './supabase'
import { hoursOf, noteWithoutHours } from './officeHours'

export function formatLocal(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`)
}

export function formatDate(dateStr) {
    return toDate(dateStr).toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

export function formatDateShort(dateStr) {
    return toDate(dateStr).toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    })
}

export function formatTime(time) {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

export function getToday() {
    return formatLocal(new Date())
}

export const CLOSED_WEEKDAYS = [0, 1, 6]

export function isClosedWeekday(dow) {
    return CLOSED_WEEKDAYS.includes(dow)
}

export function isWeekendDate(dateStr) {
    return isClosedWeekday(toDate(dateStr).getDay())
}

export function weekdayName(dateStr) {
    return toDate(dateStr).toLocaleDateString('en-PH', { weekday: 'long' })
}

export async function isClosedWithoutOpening(dateStr) {
    if (!isWeekendDate(dateStr)) return false

    const { data } = await supabase
        .from('office_open_days')
        .select('open_day_id')
        .eq('open_date', dateStr)
        .maybeSingle()

    return !data
}

export function addDays(dateStr, delta) {
    const d = toDate(dateStr)
    return formatLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta))
}

export function eachDateInRange(startStr, endStr) {
    const dates = []
    let cursor = toDate(startStr)
    const end = toDate(endStr)
    while (cursor <= end) {
        dates.push(formatLocal(cursor))
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    }
    return dates
}

export function buildMonthGrid(viewDate) {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const startWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7

    const cells = []
    for (let i = 0; i < totalCells; i++) {
        const date = new Date(year, month, 1 - startWeekday + i)
        cells.push({ date, dateStr: formatLocal(date), inMonth: date.getMonth() === month })
    }
    return cells
}

export function relativeDayLabel(dateStr, today = getToday()) {
    const diff = Math.round((toDate(dateStr) - toDate(today)) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff > 1 && diff < 7) return `In ${diff} days`
    return null
}

export function groupConsecutiveEvents(events) {
    const groups = []
    const openByTitle = new Map()

    for (const ev of events) {
        const open = openByTitle.get(ev.title)
        if (open && addDays(open.endDate, 1) === ev.event_date) {
            open.endDate = ev.event_date
            open.events.push(ev)
            continue
        }

        const group = { key: ev.event_id, title: ev.title, note: ev.note, startDate: ev.event_date, endDate: ev.event_date, events: [ev] }
        groups.push(group)
        openByTitle.set(ev.title, group)
    }

    return groups
}

export function claimDate(cs) {
    return cs.claim_date || cs.scheduled_date
}

export function claimTime(cs) {
    return cs.claim_time || cs.scheduled_time
}

export const EVENT_PRESETS = [
    'Mental Health Break',
    'Office Closed — Fiesta',
    'Office Closed — Holiday',
    'Enrollment Week',
    'System Maintenance',
]

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export async function fetchOfficeScheduleNotices() {
    const today = getToday()
    const until = addDays(today, 14)

    const { data, error } = await supabase
        .from('office_open_days')
        .select('*')
        .gte('open_date', today)
        .lte('open_date', until)
        .order('open_date')

    const openDays = error ? [] : (data || []).filter((d) => isWeekendDate(d.open_date))
    const openSet = new Set(openDays.map((d) => d.open_date))
    const isOpen = (dateStr) => !isWeekendDate(dateStr) || openSet.has(dateStr)

    const notices = []

    if (!isOpen(today)) {
        let next = addDays(today, 1)
        while (!isOpen(next)) next = addDays(next, 1)

        notices.push({
            announcement_id: `office-closed-${today}`,
            announcement_date: today,
            is_closed: true,
            title: `The Registrar's Office is closed today (${weekdayName(today)})`,
            message: `We're closed on Mondays, Saturdays and Sundays. Claiming and walk-in queuing resume on <strong>${formatDate(next)}</strong>.`,
        })
    }

    for (const day of openDays) {
        const hours = hoursOf(day)
        const note = noteWithoutHours(day.note)
        notices.push({
            announcement_id: `office-open-${day.open_date}`,
            announcement_date: day.open_date,
            is_closed: false,
            open_time: day.open_time,
            close_time: day.close_time,
            title: `The Registrar's Office is open on ${weekdayName(day.open_date)}${hours ? `, ${hours}` : ''}`,
            message: note
                ? `${escapeHtml(note)}${hours ? ` Office hours: <strong>${hours}</strong>.` : ''}`
                : `Although ${weekdayName(day.open_date)}s are normally closed, the office will be open this day${hours ? ` from <strong>${hours}</strong>` : ''} for claiming and walk-ins.`,
        })
    }

    notices.push({
        announcement_id: 'office-days',
        announcement_date: null,
        is_closed: false,
        title: 'Office days: Tuesday to Friday',
        message: "The Registrar's Office is closed every <strong>Monday, Saturday and Sunday</strong> unless it's announced here as open.",
    })

    return notices
}
