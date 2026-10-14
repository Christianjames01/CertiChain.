import { supabase } from './supabase'

export async function loadHiddenMessageIds(userId) {
    const { data, error } = await supabase
        .from('message_hidden')
        .select('message_id')
        .eq('user_id', userId)

    if (error) {
        console.warn('LOAD HIDDEN MESSAGES ERROR:', error)
        return new Set()
    }

    return new Set((data || []).map((h) => h.message_id))
}

export async function hideMessagesForMe(userId, messageIds) {
    const { error } = await supabase
        .from('message_hidden')
        .upsert(
            messageIds.map((id) => ({ user_id: userId, message_id: id })),
            { onConflict: 'user_id,message_id', ignoreDuplicates: true }
        )

    if (error) throw new Error('Failed to delete message: ' + error.message)
}

export async function editOwnMessage(messageId, newText, replyTo = null) {
    const { error } = await supabase.rpc('edit_my_message', {
        p_message_id: String(messageId),
        p_new_text: replyTo ? `[[reply=${replyTo}]]${newText}` : newText,
    })

    if (error) throw new Error(error.message)
}

export function siblingMessageIds(msgs, allRows) {
    const keys = new Set(msgs.map((m) => `${m.sender_user_id}|${m.created_at}`))
    const ids = new Set(msgs.map((m) => m.message_id))
    for (const r of allRows) {
        if (keys.has(`${r.sender_user_id}|${r.created_at}`)) ids.add(r.message_id)
    }
    return [...ids]
}

export async function deleteOwnMessage(messageId) {
    const { error } = await supabase.rpc('delete_my_message', { p_message_id: String(messageId) })
    if (error) throw new Error(error.message)
}

export function markSendDeleted(list, deletedMsg, userId) {
    const deleted_at = new Date().toISOString()
    return list.map((x) => (isSameSend(x, deletedMsg) ? { ...x, deleted_at, deleted_by: userId } : x))
}

export function isSameSend(m, edited) {
    return m.sender_user_id === edited.sender_user_id && m.created_at === edited.created_at
}

const REF_TAG = /^\[\[ref=([0-9a-f-]+)\]\]/

export function refOf(text) {
    return (text || '').match(REF_TAG)?.[1] || null
}

export function stripRef(text) {
    return (text || '').replace(REF_TAG, '')
}

const REPLY_TAG = /^\[\[reply=([0-9a-f-]+)\]\]/

export function withReplyTag(text, replyToId) {
    return replyToId ? `[[reply=${replyToId}]]${text}` : text
}

export function readMessage(row) {
    const text = stripRef(row.message)
    const match = text.match(REPLY_TAG)
    return match
        ? { ...row, message: text.slice(match[0].length), replyTo: match[1] }
        : { ...row, message: text, replyTo: row.replyTo || null }
}

export function quoteFor(m, { byId, selfId, nameOf, onJump }) {
    if (!m.replyTo) return null
    const original = byId[m.replyTo]
    const senderIsSelf = m.sender_user_id === selfId
    const who = senderIsSelf ? 'You' : (nameOf(m.sender_user_id) || 'Someone').split(' ')[0]

    if (!original) return { label: `${who} replied to a message`, text: 'Original message unavailable' }

    const toSelf = original.sender_user_id === selfId
    const target = toSelf
        ? (senderIsSelf ? 'yourself' : 'you')
        : original.sender_user_id === m.sender_user_id ? 'themself' : (nameOf(original.sender_user_id) || 'someone').split(' ')[0]

    return {
        label: `${who} replied to ${target}`,
        text: original.deleted_at ? 'Message deleted' : original.message,
        onClick: onJump ? () => onJump(original.message_id) : undefined,
    }
}

export function jumpToMessage(messageId) {
    const el = document.getElementById(`msg-${messageId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('is-flash')
    void el.offsetWidth
    el.classList.add('is-flash')
}
