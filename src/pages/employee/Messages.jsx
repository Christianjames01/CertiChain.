import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { notify, notifyError, confirmModal } from '../../lib/notify'
import { useConversationPresence, presenceLabel } from '../../lib/presence'
import { loadReactions, toggleReaction, groupReactions } from '../../lib/messageReactions'
import { buildSenderLabels } from '../../lib/messageSenderLabel'
import { markMessagesRead, unreadReceived, withRead } from '../../lib/markMessagesRead'
import { SkeletonList } from '../../components/Skeleton'
import MessageBubble from '../../components/MessageBubble'
import { ChatApp, ChatSidebar, ChatListItem, ChatListEmpty, ChatPane, ChatHeader, ChatMessages, ChatComposer, ChatPlaceholder, ChatAvatar } from '../../components/ChatApp'
import { chatListTime, chatBubbleTime } from '../../lib/chatTime'
import { loadHiddenMessageIds, editOwnMessage, deleteOwnMessage, markSendDeleted, isSameSend, readMessage, withReplyTag, quoteFor, jumpToMessage } from '../../lib/messageActions'
import './EmployeePages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { useTyping } from '../../lib/useTyping'
import { pendingInquiry, statusReplyFor, inquiryRequestNumber, inquiryLabel } from '../../lib/requestStatusMessages'
import { friendlyError } from '../../lib/friendlyError'

function Messages() {
    const [userId, setUserId] = useState(null)
    const [threads, setThreads] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [activeId, setActiveId] = useState(null)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const [senderNames, setSenderNames] = useState({})
    const [reactionRows, setReactionRows] = useState([])
    const [busy, setBusy] = useState(false)
    const [fillingStatus, setFillingStatus] = useState(false)
    const [replyTo, setReplyTo] = useState(null)

    useLiveRefresh(['messages', 'message_reactions'], (options) => loadMessages(options))
    const { typingUserIds, sendTyping } = useTyping(userId)

    useEffect(() => {
        loadMessages()
    }, [])

    const loadMessages = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            setUserId(user.id)

            const [{ data, error: messagesError }, hiddenIds] = await Promise.all([
                supabase
                    .from('messages')
                    .select('*')
                    .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
                    .order('created_at', { ascending: true }),
                loadHiddenMessageIds(user.id),
            ])

            if (messagesError) {
                throw new Error('Failed to load messages: ' + messagesError.message)
            }

            const rows = (data || []).filter((m) => !hiddenIds.has(m.message_id))
            loadReactions(rows.map((m) => m.message_id)).then(setReactionRows)

            const otherUserIds = [
                ...new Set(
                    rows.map((m) => (m.sender_user_id === user.id ? m.receiver_user_id : m.sender_user_id))
                )
            ]
            const refStudentIds = [...new Set(rows.map((m) => m.message.match(/^\[\[ref=([0-9a-f-]+)\]\]/)?.[1]).filter(Boolean))]
            const everyoneIds = [...new Set([...otherUserIds, ...refStudentIds])]

            const [{ data: profiles }, prefetchedLabels] = await Promise.all([
                everyoneIds.length
                    ? supabase.from('profiles').select('user_id, first_name, last_name, role, profile_photo_url').in('user_id', everyoneIds)
                    : Promise.resolve({ data: [] }),
                buildSenderLabels(everyoneIds, { showRegistrarHeadName: true }),
            ])

            const profileByUserId = Object.fromEntries(
                (profiles || []).map((p) => [p.user_id, p])
            )

            const REF_TAG = /^\[\[ref=([0-9a-f-]+)\]\]/

            const redirectToStudent = {}
            const studentIdsToFetch = new Set()

            for (const m of rows) {
                const match = m.message.match(REF_TAG)
                if (!match) continue
                redirectToStudent[m.message_id] = match[1]
                if (!profileByUserId[match[1]]) studentIdsToFetch.add(match[1])
            }

            const labels = prefetchedLabels

            const fanOutKey = (m) => `${m.message}|${m.created_at}`
            const studentForFanOut = {}

            for (const m of rows) {
                if (m.sender_user_id !== user.id) continue
                if (profileByUserId[m.receiver_user_id]?.role === 'student') {
                    studentForFanOut[fanOutKey(m)] = m.receiver_user_id
                }
            }

            const shownOwnReplies = new Set()
            const grouped = {}

            for (const m of rows) {
                const rawOtherId = m.sender_user_id === user.id ? m.receiver_user_id : m.sender_user_id
                const ownFanOutStudent = m.sender_user_id === user.id ? studentForFanOut[fanOutKey(m)] : null
                const otherId = redirectToStudent[m.message_id] || ownFanOutStudent || rawOtherId
                const displayMessage = m.message.replace(REF_TAG, '')

                if (ownFanOutStudent) {
                    const bubbleKey = `${otherId}|${fanOutKey(m)}`
                    if (shownOwnReplies.has(bubbleKey)) continue
                    shownOwnReplies.add(bubbleKey)
                }

                if (!grouped[otherId]) {
                    grouped[otherId] = {
                        otherUserId: otherId,
                        name: labels[otherId] || 'Unknown',
                        photo: profileByUserId[otherId]?.profile_photo_url || '',
                        role: profileByUserId[otherId]?.role || '',
                        messages: [],
                        unreadCount: 0,
                        extraParticipantIds: new Set(),
                    }
                }

                grouped[otherId].messages.push(readMessage({ ...m, message: displayMessage }))

                if (m.receiver_user_id === user.id && !m.is_read) {
                    grouped[otherId].unreadCount += 1
                }

                if (m.sender_user_id !== user.id && m.sender_user_id !== otherId) {
                    grouped[otherId].extraParticipantIds.add(m.sender_user_id)
                }
            }

            for (const group of Object.values(grouped)) {
                group.messages.sort((a, b) => a.created_at.localeCompare(b.created_at))
                group.extraParticipantIds = [...group.extraParticipantIds]
            }

            const threadList = Object.values(grouped).sort((a, b) => {
                const aLast = a.messages[a.messages.length - 1]?.created_at || ''
                const bLast = b.messages[b.messages.length - 1]?.created_at || ''
                return bLast.localeCompare(aLast)
            })

            setThreads(threadList)
            setSenderNames(labels)

        } catch (err) {
            console.error('MESSAGES ERROR:', err)
            setError(err.message || 'Failed to load messages.')
        } finally {
            setLoading(false)
        }
    }

    const markThreadsRead = async (targetThreads) => {
        const ids = targetThreads.flatMap((t) => unreadReceived(t.messages, userId).map((m) => m.message_id))
        if (ids.length === 0) return

        try {
            await markMessagesRead(ids)
            const targetKeys = new Set(targetThreads.map((t) => t.otherUserId))
            setThreads((prev) =>
                prev.map((t) =>
                    targetKeys.has(t.otherUserId) ? { ...t, messages: withRead(t.messages, ids), unreadCount: 0 } : t
                )
            )
        } catch (err) {
            notifyError(friendlyError(err))
        }
    }

    const activeThread = threads.find((t) => t.otherUserId === activeId) || null

    const openThread = (thread) => {
        setActiveId(thread.otherUserId)
        setReply('')
        setReplyTo(null)
    }

    const activeUnread = activeThread ? unreadReceived(activeThread.messages, userId).length : 0
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (activeThread && activeUnread > 0) markThreadsRead([activeThread])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId, activeUnread])

    const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0)

    const partnerPresence = useConversationPresence(activeThread?.otherUserId || null)

    const sendReply = async () => {
        if (!reply.trim() || !activeThread) return

        const recipientIds = [activeThread.otherUserId, ...(activeThread.extraParticipantIds || [])]

        try {
            setSending(true)

            const rows = recipientIds.map((id) => ({
                sender_user_id: userId,
                receiver_user_id: id,
                message: withReplyTag(reply.trim(), replyTo?.message_id),
                is_read: false,
            }))

            const { data, error: sendError } = await supabase
                .from('messages')
                .insert(rows)
                .select()

            if (sendError) {
                throw new Error('Failed to send message: ' + sendError.message)
            }

            await Promise.all(recipientIds.map((id) => notify({
                userId: id,
                title: 'New message',
                message: reply.trim(),
                notificationType: 'message',
            })))

            const displayRow = readMessage(data.find((d) => d.receiver_user_id === activeThread.otherUserId) || data[0])

            const updatedThread = {
                ...activeThread,
                messages: [...activeThread.messages, displayRow],
            }

            setThreads((prev) =>
                prev.map((t) => (t.otherUserId === activeThread.otherUserId ? updatedThread : t))
            )
            setReply('')
            setReplyTo(null)
            sendTyping(recipientIds, false)

        } catch (err) {
            console.error('SEND MESSAGE ERROR:', err)
            notifyError(friendlyError(err, 'Failed to send message.'))
        } finally {
            setSending(false)
        }
    }

    const replaceActiveThread = (updatedThread) => {
        if (updatedThread.messages.length === 0) setActiveId(null)
        setThreads((prev) =>
            updatedThread.messages.length === 0
                ? prev.filter((t) => t.otherUserId !== updatedThread.otherUserId)
                : prev.map((t) => (t.otherUserId === updatedThread.otherUserId ? updatedThread : t))
        )
    }

    const deleteMessage = async (m) => {
        const confirmed = await confirmModal(
            'Delete this message for everyone? Everyone in the conversation will see that you deleted a message instead.',
            { title: 'Delete message?', confirmButtonText: 'Delete', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setBusy(true)
            await deleteOwnMessage(m.message_id)
            replaceActiveThread({ ...activeThread, messages: markSendDeleted(activeThread.messages, m, userId) })
        } catch (err) {
            console.error('DELETE MESSAGE ERROR:', err)
            notifyError(friendlyError(err, 'Failed to delete message.'))
        } finally {
            setBusy(false)
        }
    }

    const deletedLabel = (m) => {
        if (!m?.deleted_at) return null
        const by = m.deleted_by || m.sender_user_id
        return by === userId ? 'You deleted a message' : `${senderNames[by] || 'Someone'} deleted a message`
    }

    const editMessage = async (m, newText) => {
        try {
            await editOwnMessage(m.message_id, newText, m.replyTo)
            const edited_at = new Date().toISOString()
            replaceActiveThread({
                ...activeThread,
                messages: activeThread.messages.map((x) => (isSameSend(x, m) ? { ...x, message: newText, edited_at } : x)),
            })
            return true
        } catch (err) {
            console.error('EDIT MESSAGE ERROR:', err)
            notifyError(friendlyError(err, 'Failed to edit message.'))
            return false
        }
    }

    const reactToMessage = async (m, emoji) => {
        const mine = reactionRows.find((r) => r.message_id === m.message_id && r.user_id === userId)
        try {
            const result = await toggleReaction(m.message_id, userId, emoji, mine)
            setReactionRows((prev) => {
                const withoutMine = prev.filter((r) => !(r.message_id === m.message_id && r.user_id === userId))
                return result ? [...withoutMine, { message_id: m.message_id, user_id: userId, emoji: result }] : withoutMine
            })
        } catch (err) {
            console.error('REACT TO MESSAGE ERROR:', err)
            notifyError(friendlyError(err, 'Failed to react to the message.'))
        }
    }

    const inquiry = activeThread ? pendingInquiry(activeThread.messages, userId) : null
    const inquiryNumber = inquiryRequestNumber(inquiry?.message)
    const fillStatusReply = async () => {
        try {
            setFillingStatus(true)
            setReply(await statusReplyFor(inquiryNumber, inquiry.sender_user_id))
            setReplyTo(inquiry)
        } catch (err) {
            notifyError(friendlyError(err, 'Could not look up that request.'))
        } finally {
            setFillingStatus(false)
        }
    }

    const q = search.trim().toLowerCase()
    const visibleThreads = threads
        .filter((t) => filter !== 'unread' || t.unreadCount > 0)
        .filter((t) => !q || t.name.toLowerCase().includes(q))

    const previewOf = (m) => {
        if (!m) return ''
        if (m.deleted_at) return deletedLabel(m)
        return `${m.sender_user_id === userId ? 'You: ' : ''}${m.message}`
    }

    const personOf = (thread) => ({ name: thread.name, photo: thread.photo })
    const nameOf = (id) => (id === userId ? 'You' : id === activeThread?.otherUserId ? activeThread.name : senderNames[id] || 'Someone')
    const threadById = activeThread ? Object.fromEntries(activeThread.messages.map((m) => [m.message_id, m])) : {}

    const typersIn = (thread) =>
        [thread.otherUserId, ...(thread.extraParticipantIds || [])].filter((id) => typingUserIds.includes(id))
    const activeTypers = activeThread ? typersIn(activeThread) : []
    const typerName = (id) => (id === activeThread?.otherUserId ? activeThread.name : senderNames[id] || 'Someone')

    return (
        <div>
            {error && <div className="employee-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={4} />
            ) : (
                <ChatApp chatOpen={!!activeThread}>
                    <ChatSidebar
                        title="Messages"
                        subtitle="Student inquiries and conversations."
                        actions={totalUnread > 0 && (
                            <button type="button" className="chat-pill-button" onClick={() => markThreadsRead(threads)}>
                                Mark all read
                            </button>
                        )}
                        toolbar={threads.length > 0 && (
                            <>
                                <input
                                    className="chat-search"
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search Messages"
                                    aria-label="Search conversations"
                                />
                                <div className="chat-tabs">
                                    {[
                                        { key: 'all', label: 'All' },
                                        { key: 'unread', label: 'Unread', count: threads.filter((t) => t.unreadCount > 0).length },
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            className={`chat-tab${filter === tab.key ? ' is-active' : ''}`}
                                            onClick={() => setFilter(tab.key)}
                                        >
                                            {tab.label}{tab.count ? <span>{tab.count}</span> : null}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    >
                        {threads.length === 0 ? (
                            <ChatListEmpty>No messages yet. Conversations with students will show up here.</ChatListEmpty>
                        ) : visibleThreads.length === 0 ? (
                            <ChatListEmpty>No conversations match.</ChatListEmpty>
                        ) : (
                            visibleThreads.map((thread) => {
                                const last = thread.messages[thread.messages.length - 1]
                                return (
                                    <ChatListItem
                                        key={thread.otherUserId}
                                        active={thread.otherUserId === activeId}
                                        unread={thread.unreadCount}
                                        people={[personOf(thread)]}
                                        name={thread.name}
                                        preview={previewOf(last)}
                                        time={last ? chatListTime(last.created_at) : ''}
                                        typing={typersIn(thread).length > 0}
                                        onClick={() => openThread(thread)}
                                    />
                                )
                            })
                        )}
                    </ChatSidebar>

                    <ChatPane label={activeThread ? `Conversation with ${activeThread.name}` : 'Conversation'}>
                        {!activeThread ? (
                            <ChatPlaceholder title="Your messages" text="Pick a conversation to read and reply." />
                        ) : (
                            <>
                                <ChatHeader
                                    onBack={() => setActiveId(null)}
                                    people={[personOf(activeThread)]}
                                    title={activeThread.name}
                                    subtitle={[
                                        activeThread.role === 'student' ? 'Student' : "Registrar's Office",
                                        presenceLabel(partnerPresence),
                                    ].filter(Boolean).join(' · ')}
                                    typing={activeTypers.length > 0 && `${typerName(activeTypers[0])} is typing…`}
                                />

                                <ChatMessages
                                    messages={activeThread.messages}
                                    threadKey={activeThread.otherUserId}
                                    typing={activeTypers.length > 0 && {
                                        people: [activeTypers[0] === activeThread.otherUserId ? personOf(activeThread) : { name: typerName(activeTypers[0]) }],
                                        label: `${typerName(activeTypers[0])} is typing`,
                                    }}
                                    empty="No messages yet."
                                    renderMessage={(m, { groupStart, groupEnd }) => {
                                        const isSelf = m.sender_user_id === userId
                                        const senderName = senderNames[m.sender_user_id] || 'Unknown'
                                        const fromOtherPerson = !isSelf && m.sender_user_id !== activeThread.otherUserId
                                        const isLastInThread = m.message_id === activeThread.messages[activeThread.messages.length - 1]?.message_id
                                        const myReactionRow = reactionRows.find((r) => r.message_id === m.message_id && r.user_id === userId)

                                        return (
                                            <MessageBubble
                                                key={m.message_id}
                                                messageId={m.message_id}
                                                isSelf={isSelf}
                                                onReply={() => setReplyTo(m)}
                                                quote={quoteFor(m, { byId: threadById, selfId: userId, nameOf, onJump: jumpToMessage })}
                                                senderLabel={fromOtherPerson && groupStart ? senderName : null}
                                                avatar={isSelf ? undefined : (
                                                    <ChatAvatar
                                                        people={[fromOtherPerson ? { name: senderName } : personOf(activeThread)]}
                                                        size={28}
                                                    />
                                                )}
                                                groupStart={groupStart}
                                                groupEnd={groupEnd}
                                                text={m.message}
                                                time={groupEnd ? chatBubbleTime(m.created_at) : null}
                                                edited={!!m.edited_at}
                                                deletedNote={deletedLabel(m)}
                                                seen={isSelf && isLastInThread && !!m.is_read}
                                                reactions={groupReactions(reactionRows.filter((r) => r.message_id === m.message_id), userId)}
                                                myReaction={myReactionRow?.emoji || null}
                                                onReact={deletedLabel(m) ? undefined : (emoji) => reactToMessage(m, emoji)}
                                                onEdit={isSelf ? (text) => editMessage(m, text) : undefined}
                                                onDelete={isSelf ? () => deleteMessage(m) : undefined}
                                                disabled={busy}
                                            />
                                        )
                                    }}
                                />

                                <ChatComposer
                                    value={reply}
                                    onChange={(value) => {
                                        setReply(value)
                                        sendTyping([activeThread.otherUserId, ...(activeThread.extraParticipantIds || [])], !!value.trim())
                                    }}
                                    onSend={sendReply}
                                    replyingTo={replyTo && {
                                        id: replyTo.message_id,
                                        name: replyTo.sender_user_id === userId ? 'yourself' : nameOf(replyTo.sender_user_id),
                                        text: replyTo.message,
                                    }}
                                    onCancelReply={() => setReplyTo(null)}
                                    sending={sending}
                                    canSend={!!reply.trim()}
                                    placeholder={`Message ${activeThread.name}…`}
                                    above={inquiryNumber && (
                                        <div className="chat-composer-extra">
                                            <button type="button" className="chat-pill-button" onClick={fillStatusReply} disabled={fillingStatus}>
                                                {fillingStatus ? 'Looking up…' : `Reply with status of ${inquiryLabel(inquiryNumber)}`}
                                            </button>
                                        </div>
                                    )}
                                />
                            </>
                        )}
                    </ChatPane>
                </ChatApp>
            )}
        </div>
    )
}

export default Messages
