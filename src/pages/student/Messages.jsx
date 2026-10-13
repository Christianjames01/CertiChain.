import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { findAssignedEmployee } from '../../lib/assignEmployee'
import { notify, notifyError, confirmModal } from '../../lib/notify'
import { useConversationPresence, presenceLabel } from '../../lib/presence'
import { loadReactions, toggleReaction, groupReactions } from '../../lib/messageReactions'
import { EmptyState } from './StudentUi'
import { IconMessage } from './icons'
import { buildSenderLabels, REGISTRAR_LABEL } from '../../lib/messageSenderLabel'
import { markMessagesRead, unreadReceived, withRead } from '../../lib/markMessagesRead'
import { SkeletonList } from '../../components/Skeleton'
import MessageBubble from '../../components/MessageBubble'
import { ChatApp, ChatSidebar, ChatListItem, ChatPane, ChatHeader, ChatMessages, ChatComposer, ChatPlaceholder, ChatAvatar } from '../../components/ChatApp'
import { chatListTime, chatBubbleTime } from '../../lib/chatTime'
import { loadHiddenMessageIds, editOwnMessage, deleteOwnMessage, markSendDeleted, isSameSend, refOf, readMessage, withReplyTag, quoteFor, jumpToMessage } from '../../lib/messageActions'
import '../auth/Auth.css'
import './StudentPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { useTyping } from '../../lib/useTyping'
import { ALL_REQUESTS, groupRequests, inquiryText, requestStatusLabel } from '../../lib/requestStatusMessages'
import { friendlyError } from '../../lib/friendlyError'

const DEFAULT_MESSAGE =
    "Hi, I'd like to ask about my document request. Please let me know if you need anything " +
    "from me — I'll check back here for your reply. Thank you!"

const CLOSED_STATUSES = ['completed', 'cancelled', 'rejected']

const otherParty = (m, userId) => (m.sender_user_id === userId ? m.receiver_user_id : m.sender_user_id)

function Messages() {
    const [searchParams, setSearchParams] = useSearchParams()
    const requestedEmployeeId = searchParams.get('employee')

    const [userId, setUserId] = useState(null)
    const [contacts, setContacts] = useState([])
    const [selectedUserId, setSelectedUserId] = useState(null)
    const [messages, setMessages] = useState([])
    const [reactionRows, setReactionRows] = useState([])
    const [threadOf, setThreadOf] = useState({})
    const [labels, setLabels] = useState({})
    const [reply, setReply] = useState('')
    const [requests, setRequests] = useState([])
    const [askOpen, setAskOpen] = useState(false)
    const [replyTo, setReplyTo] = useState(null)
    const [autoTyping, setAutoTyping] = useState(null)
    const [chatOpen, setChatOpen] = useState(!!requestedEmployeeId)

    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useLiveRefresh(['messages', 'message_reactions'], (options) => loadMessages(options))
    const { typingUserIds, sendTyping } = useTyping(userId)

    useEffect(() => {
        if (!userId) return undefined
        const channel = supabase
            .channel(`messages-incoming-${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_user_id=eq.${userId}` }, (payload) => {
                addMessage(readMessage(payload.new))
            })
            .subscribe()
        return () => supabase.removeChannel(channel)
    }, [userId])

    useEffect(() => {
        loadMessages()
    }, [])

    const loadMessages = async ({ silent = false } = {}) => {
        try {
            setError('')

            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) throw new Error('You are not logged in.')
            setUserId(user.id)

            const [{ data: student, error: studentError }, { data: messageRows, error: messagesError }, hiddenIds, { data: documentTypes }] = await Promise.all([
                supabase.from('students').select('student_id, college_id, program_id').eq('user_id', user.id).single(),
                supabase
                    .from('messages')
                    .select('*')
                    .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
                    .order('created_at', { ascending: true }),
                loadHiddenMessageIds(user.id),
                supabase.from('document_types').select('document_type_id, document_name'),
            ])

            if (studentError || !student) throw new Error('Student record could not be found.')
            if (messagesError) throw new Error('Failed to load messages: ' + messagesError.message)

            const rows = (messageRows || [])
                .filter((m) => !hiddenIds.has(m.message_id))
                .map((m) => {
                    const ref = refOf(m.message)
                    const shown = readMessage(m)
                    return ref ? { ...shown, refUserId: ref } : shown
                })
            const messageParties = [...new Set(rows.map((m) => otherParty(m, user.id)))].filter(Boolean)

            const [{ data: requestRows }, partyLabels] = await Promise.all([
                supabase
                    .from('document_requests')
                    .select('request_id, request_number, status, assigned_employee_id, document_type_id, requested_at')
                    .eq('student_id', student.student_id)
                    .order('requested_at', { ascending: false }),
                buildSenderLabels(messageParties),
            ])

            const ownRequests = (requestRows || []).filter((r) => r.assigned_employee_id)
            const requestsByEmployee = {}
            for (const r of ownRequests) {
                if (!requestsByEmployee[r.assigned_employee_id]) requestsByEmployee[r.assigned_employee_id] = []
                requestsByEmployee[r.assigned_employee_id].push(r)
            }

            let employeeIds = Object.keys(requestsByEmployee)
            if (employeeIds.length === 0) {
                const fallback = await findAssignedEmployee(student.college_id, student.program_id)
                if (fallback) employeeIds = [fallback]
            }

            const { data: employeeRows } = employeeIds.length
                ? await supabase
                    .from('employees')
                    .select('employee_id, user_id, employee_number, position_title, display_name')
                    .in('employee_id', employeeIds)
                : { data: [] }

            const employeeUserIds = (employeeRows || []).map((e) => e.user_id)
            const missing = employeeUserIds.filter((id) => !partyLabels[id])
            const labels = missing.length ? { ...partyLabels, ...(await buildSenderLabels(missing)) } : partyLabels

            const employeeUserSet = new Set(employeeUserIds)
            const assigned = {}
            for (const m of rows) {
                const other = otherParty(m, user.id)
                assigned[m.message_id] = !employeeUserSet.has(other) && m.refUserId && employeeUserSet.has(m.refUserId)
                    ? m.refUserId
                    : other
            }

            const lastAt = (uid) => {
                const thread = rows.filter((m) => assigned[m.message_id] === uid)
                return thread.length ? new Date(thread[thread.length - 1].created_at).getTime() : 0
            }

            const list = (employeeRows || []).map((e) => {
                const handled = requestsByEmployee[e.employee_id] || []
                const active = handled.filter((r) => !CLOSED_STATUSES.includes(r.status))
                return {
                    userId: e.user_id,
                    employeeId: e.employee_id,
                    name: e.display_name?.trim() || labels[e.user_id] || e.employee_number,
                    subtitle: e.position_title || 'Registrar staff',
                    requests: (active.length ? active : handled).map((r) => r.request_number),
                    handlesActive: active.length > 0,
                    latestRequestAt: handled[0] ? new Date(handled[0].requested_at).getTime() : 0,
                    lastAt: lastAt(e.user_id),
                }
            })

            for (const uid of new Set(Object.values(assigned))) {
                if (!uid || list.some((c) => c.userId === uid)) continue
                list.push({
                    userId: uid,
                    employeeId: null,
                    name: labels[uid] || REGISTRAR_LABEL,
                    subtitle: "Registrar's Office",
                    requests: [],
                    handlesActive: false,
                    latestRequestAt: 0,
                    lastAt: lastAt(uid),
                })
            }

            list.sort((a, b) => Number(b.handlesActive) - Number(a.handlesActive) || b.lastAt - a.lastAt || b.latestRequestAt - a.latestRequestAt)

            const docName = Object.fromEntries((documentTypes || []).map((t) => [t.document_type_id, t.document_name]))

            setRequests((requestRows || []).map((r) => ({ ...r, documentName: docName[r.document_type_id] || '' })))
            setContacts(list)
            setMessages(rows)
            loadReactions(rows.map((m) => m.message_id)).then(setReactionRows)
            setThreadOf(assigned)
            setLabels(labels)

            if (!silent) setSelectedUserId((current) => {
                if (current && list.some((c) => c.userId === current)) return current
                const requested = requestedEmployeeId && list.find((c) => c.employeeId === requestedEmployeeId)
                return (requested || list[0])?.userId || null
            })
        } catch (err) {
            console.error('STUDENT MESSAGES ERROR:', err)
            setError(err.message || 'Failed to load messages.')
        } finally {
            setLoading(false)
        }
    }

    const selected = contacts.find((c) => c.userId === selectedUserId) || null
    const threadFor = (m) => threadOf[m.message_id] || otherParty(m, userId)
    const thread = selected ? messages.filter((m) => threadFor(m) === selected.userId) : []
    const unreadInThread = unreadReceived(thread, userId)
    const partnerPresence = useConversationPresence(selected?.userId || null)

    const selectContact = (contact) => {
        setSelectedUserId(contact.userId)
        setChatOpen(true)
        setReply('')
        setReplyTo(null)
        if (contact.employeeId) setSearchParams({ employee: contact.employeeId }, { replace: true })
        else setSearchParams({}, { replace: true })
    }

    const markThreadRead = async () => {
        const ids = unreadInThread.map((m) => m.message_id)
        if (ids.length === 0) return
        try {
            await markMessagesRead(ids)
            setMessages((prev) => withRead(prev, ids))
        } catch (err) {
            notifyError(friendlyError(err))
        }
    }

    const threadVisible = !!selected && (chatOpen || !window.matchMedia('(max-width: 880px)').matches)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (threadVisible && unreadInThread.length > 0) markThreadRead()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [threadVisible, selectedUserId, unreadInThread.length])

    const addMessage = (row) =>
        setMessages((prev) => (prev.some((m) => m.message_id === row.message_id) ? prev : [...prev, row]))

    const sendText = async (text, contact, replyToId = null) => {
        const { data, error: sendError } = await supabase
            .from('messages')
            .insert({
                sender_user_id: userId,
                receiver_user_id: contact.userId,
                message: withReplyTag(text, replyToId),
                is_read: false,
            })
            .select()
            .single()

        if (sendError) throw new Error('Failed to send message: ' + sendError.message)

        await notify({
            userId: contact.userId,
            title: 'New message',
            message: text,
            notificationType: 'message',
        })

        const shown = readMessage(data)
        addMessage(shown)
        return shown
    }

    const askAboutRequest = async (request) => {
        setAskOpen(false)
        const all = request === ALL_REQUESTS
        const contact = selected
        if (!contact || !userId) return
        let question

        try {
            setSending(true)
            question = await sendText(inquiryText(request), contact)
        } catch (err) {
            console.error('ASK ABOUT REQUEST ERROR:', err)
            notifyError(friendlyError(err, 'Failed to send your question.'))
            return
        } finally {
            setSending(false)
        }

        await new Promise((resolve) => setTimeout(resolve, 700))
        setAutoTyping(contact.userId)
        try {
            await new Promise((resolve) => setTimeout(resolve, 1800 + Math.random() * 900))

            const { data: autoReply, error: replyError } = await supabase.rpc('auto_reply_request_status', {
                p_request_id: all ? null : request.request_id,
                p_reply_as: contact.userId,
                p_reply_to: question?.message_id || null,
            })
            if (replyError) console.warn('AUTO STATUS REPLY UNAVAILABLE:', replyError.message)
            else if (autoReply) addMessage(readMessage(autoReply))
        } catch (err) {
            console.warn('AUTO STATUS REPLY ERROR:', err)
        } finally {
            setAutoTyping(null)
        }
    }

    const sendMessage = async () => {
        const text = (reply || (thread.length === 0 ? DEFAULT_MESSAGE : '')).trim()
        if (!text || !selected || !userId) return

        try {
            setSending(true)
            await sendText(text, selected, replyTo?.message_id)
            setReply('')
            setReplyTo(null)
            sendTyping([selected.userId], false)
        } catch (err) {
            console.error('SEND MESSAGE ERROR:', err)
            notifyError(friendlyError(err, 'Failed to send message.'))
        } finally {
            setSending(false)
        }
    }

    const deleteMessage = async (m) => {
        const confirmed = await confirmModal(
            'Delete this message for everyone? The registrar staff will see that you deleted a message instead.',
            { title: 'Delete message?', confirmButtonText: 'Delete', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setBusy(true)
            await deleteOwnMessage(m.message_id)
            setMessages((prev) => markSendDeleted(prev, m, userId))
        } catch (err) {
            console.error('DELETE MESSAGE ERROR:', err)
            notifyError(friendlyError(err, 'Failed to delete message.'))
        } finally {
            setBusy(false)
        }
    }

    const editMessage = async (m, newText) => {
        try {
            await editOwnMessage(m.message_id, newText, m.replyTo)
            const edited_at = new Date().toISOString()
            setMessages((prev) => prev.map((x) => (isSameSend(x, m) ? { ...x, message: newText, edited_at } : x)))
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

    const threadOfContact = (c) => messages.filter((m) => threadFor(m) === c.userId)

    const typersIn = (c) => {
        const senders = new Set([c.userId, ...threadOfContact(c).map((m) => m.sender_user_id)])
        const typers = typingUserIds.filter((id) => id !== userId && senders.has(id))
        return autoTyping === c.userId && !typers.includes(autoTyping) ? [autoTyping, ...typers] : typers
    }
    const activeTypers = selected ? typersIn(selected) : []
    const typerName = (id) => (id === selected?.userId ? selected.name : labels[id] || REGISTRAR_LABEL)
    const nameOf = (id) => (id === userId ? 'You' : typerName(id))
    const threadById = Object.fromEntries(thread.map((m) => [m.message_id, m]))

    const previewOf = (m) => {
        if (!m) return 'Start a conversation'
        if (m.deleted_at) return m.sender_user_id === userId ? 'You deleted a message' : 'Message deleted'
        return `${m.sender_user_id === userId ? 'You: ' : ''}${m.message}`
    }

    return (
        <div>
            {error && <div className="student-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : contacts.length === 0 ? (
                <>
                    <div className="student-page-header">
                        <h1>Messages</h1>
                    </div>
                    <EmptyState
                        icon={<IconMessage />}
                        title="No one to message yet"
                        text="Once registrar staff are assigned to your requests or program, you can chat with them here. For urgent concerns, visit the Registrar's Office."
                        action={{ label: 'Go to Help & Support', to: '/student/help' }}
                    />
                </>
            ) : (
                <ChatApp chatOpen={chatOpen && !!selected}>
                    <ChatSidebar title="Messages" subtitle="Chat with the registrar staff handling your requests.">
                        {contacts.map((c) => {
                            const convo = threadOfContact(c)
                            const last = convo[convo.length - 1]

                            return (
                                <ChatListItem
                                    key={c.userId}
                                    active={c.userId === selectedUserId}
                                    unread={unreadReceived(convo, userId).length}
                                    people={[{ name: c.name }]}
                                    name={c.name}
                                    meta={c.requests.length ? `Handles ${c.requests.join(', ')}` : c.subtitle}
                                    preview={previewOf(last)}
                                    time={last ? chatListTime(last.created_at) : ''}
                                    typing={typersIn(c).length > 0}
                                    onClick={() => selectContact(c)}
                                />
                            )
                        })}
                    </ChatSidebar>

                    <ChatPane label={selected ? `Conversation with ${selected.name}` : 'Conversation'}>
                        {!selected ? (
                            <ChatPlaceholder title="Your messages" text="Pick a registrar staff member to chat with." />
                        ) : (
                            <>
                                <ChatHeader
                                    onBack={() => setChatOpen(false)}
                                    people={[{ name: selected.name }]}
                                    title={selected.name}
                                    subtitle={[
                                        selected.subtitle,
                                        selected.requests.length > 0 && `${selected.handlesActive ? 'Handling' : 'Handled'} ${selected.requests.join(', ')}`,
                                        presenceLabel(partnerPresence),
                                    ].filter(Boolean).join(' · ')}
                                    typing={activeTypers.length > 0 && `${typerName(activeTypers[0])} is typing…`}
                                />

                                <ChatMessages
                                    messages={thread}
                                    threadKey={selected.userId}
                                    typing={activeTypers.length > 0 && {
                                        people: [{ name: typerName(activeTypers[0]) }],
                                        label: `${typerName(activeTypers[0])} is typing`,
                                    }}
                                    empty={<>No messages with {selected.name} yet. Say hello — they'll reply here.</>}
                                    renderMessage={(m, { groupStart, groupEnd }) => {
                                        const isSelf = m.sender_user_id === userId
                                        const fromOtherStaff = !isSelf && m.sender_user_id !== selected.userId
                                        const senderLabel = isSelf
                                            ? null
                                            : fromOtherStaff
                                                ? labels[m.sender_user_id] || REGISTRAR_LABEL
                                                : selected.name
                                        const isLastInThread = m.message_id === thread[thread.length - 1]?.message_id
                                        const myReactionRow = reactionRows.find((r) => r.message_id === m.message_id && r.user_id === userId)
                                        const deletedNote = m.deleted_at
                                            ? ((m.deleted_by || m.sender_user_id) === userId ? 'You deleted a message' : `${senderLabel || REGISTRAR_LABEL} deleted a message`)
                                            : null

                                        return (
                                            <MessageBubble
                                                key={m.message_id}
                                                messageId={m.message_id}
                                                isSelf={isSelf}
                                                onReply={() => setReplyTo(m)}
                                                quote={quoteFor(m, { byId: threadById, selfId: userId, nameOf, onJump: jumpToMessage })}
                                                senderLabel={fromOtherStaff && groupStart ? senderLabel : null}
                                                avatar={isSelf ? undefined : <ChatAvatar people={[{ name: senderLabel }]} size={28} />}
                                                groupStart={groupStart}
                                                groupEnd={groupEnd}
                                                text={m.message}
                                                time={groupEnd ? chatBubbleTime(m.created_at) : null}
                                                edited={!!m.edited_at}
                                                deletedNote={deletedNote}
                                                seen={isSelf && isLastInThread && !!m.is_read}
                                                reactions={groupReactions(reactionRows.filter((r) => r.message_id === m.message_id), userId)}
                                                myReaction={myReactionRow?.emoji || null}
                                                onReact={deletedNote ? undefined : (emoji) => reactToMessage(m, emoji)}
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
                                        sendTyping([selected.userId], !!value.trim())
                                    }}
                                    onSend={sendMessage}
                                    replyingTo={replyTo && {
                                        id: replyTo.message_id,
                                        name: replyTo.sender_user_id === userId ? 'yourself' : nameOf(replyTo.sender_user_id),
                                        text: replyTo.message,
                                    }}
                                    onCancelReply={() => setReplyTo(null)}
                                    sending={sending}
                                    canSend={!!reply.trim() || thread.length === 0}
                                    placeholder={thread.length === 0 ? 'Say hello, or press send for a quick hello' : `Message ${selected.name}…`}
                                    above={requests.length > 0 && (
                                        <div className="chat-composer-extra">
                                            <div className="req-ask">
                                                <button
                                                    type="button"
                                                    className="chat-pill-button"
                                                    onClick={() => setAskOpen((o) => !o)}
                                                    aria-expanded={askOpen}
                                                    aria-haspopup="menu"
                                                    disabled={sending}
                                                >
                                                    Ask about a request
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={askOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} /></svg>
                                                </button>
                                                {askOpen && (
                                                    <div className="req-ask-menu" role="menu" aria-label="Your requests">
                                                        <p className="req-ask-hint">Get the current status sent to you right away.</p>
                                                        <button type="button" role="menuitem" className="req-ask-item is-all" onClick={() => askAboutRequest(ALL_REQUESTS)}>
                                                            <span className="req-ask-main">
                                                                <strong>All my requests</strong>
                                                                <span>The status of every request in one reply</span>
                                                            </span>
                                                            <span className="req-ask-status">{requests.length}</span>
                                                        </button>
                                                        {groupRequests(requests).map((group) => (
                                                            <div key={group.key} className="req-ask-group" role="group" aria-label={group.label}>
                                                                <span className="req-ask-group-label">{group.label} · {group.items.length}</span>
                                                                {group.items.map((r) => (
                                                                    <button key={r.request_id} type="button" role="menuitem" className="req-ask-item" onClick={() => askAboutRequest(r)}>
                                                                        <span className="req-ask-main">
                                                                            <strong>{r.request_number}</strong>
                                                                            <span>{r.documentName || 'Document request'}</span>
                                                                        </span>
                                                                        <span className={`req-ask-status status-${r.status}`}>{requestStatusLabel(r.status)}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
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
