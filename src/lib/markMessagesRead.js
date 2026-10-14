import { supabase } from './supabase'

export const MESSAGES_UPDATED_EVENT = 'messages-updated'

export function unreadReceived(messages, userId) {
    return (messages || []).filter((m) => m.receiver_user_id === userId && !m.is_read)
}

export async function markMessagesRead(messageIds) {
    if (!messageIds || messageIds.length === 0) return

    const { error } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('message_id', messageIds)

    if (error) throw new Error('Failed to mark messages as read: ' + error.message)

    window.dispatchEvent(new Event(MESSAGES_UPDATED_EVENT))
}

export function withRead(messages, messageIds) {
    const ids = new Set(messageIds)
    return messages.map((m) => (ids.has(m.message_id) ? { ...m, is_read: true } : m))
}
