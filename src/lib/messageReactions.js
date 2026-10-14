import { supabase } from './supabase'

export const REACTION_EMOJIS = ['👍', '❤️', '😆', '😮', '😢', '😡']

export async function loadReactions(messageIds) {
    if (!messageIds || messageIds.length === 0) return []

    const { data, error } = await supabase
        .from('message_reactions')
        .select('message_id, user_id, emoji')
        .in('message_id', messageIds)

    if (error) {
        console.error('LOAD REACTIONS ERROR:', error)
        return []
    }
    return data || []
}

export async function toggleReaction(messageId, userId, emoji, existing) {
    if (existing?.emoji === emoji) {
        const { error } = await supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('user_id', userId)
        if (error) throw new Error('Failed to remove reaction: ' + error.message)
        return null
    }

    const { error } = await supabase
        .from('message_reactions')
        .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id' })

    if (error) throw new Error('Failed to react: ' + error.message)
    return emoji
}

export function groupReactions(rows, selfId) {
    const byEmoji = new Map()
    for (const r of rows) {
        const entry = byEmoji.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false }
        entry.count += 1
        if (r.user_id === selfId) entry.mine = true
        byEmoji.set(r.emoji, entry)
    }
    return [...byEmoji.values()].sort((a, b) => b.count - a.count)
}
