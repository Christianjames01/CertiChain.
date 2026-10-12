import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyError, notifySuccess, confirmModal } from '../lib/notify'
import { friendlyError } from '../lib/friendlyError'
import { loadDirectoryProfiles } from '../lib/directoryProfiles'
import { HANDOFF_STAGES, loadEmployeeNames } from '../lib/requestHandoffs'
import { formatDisplayDateTime } from '../lib/formatDate'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import './RequestHandoffs.css'

// Who has handled a request, and passing it on. The employee handling a
// request passes it to a colleague for processing / production, and -- once
// it's ready for claiming -- to the claiming section (releasing staff). The
// head sees the whole chain, including their own assignments, and can pass
// it on too. All checks are enforced by handoff_request() in the database
// (see 20261012020000_request_handoffs); the trail is written by a trigger.

const CLAIMING_STATUSES = ['ready_for_claiming', 'scheduled', 'claimed']
const MAX_NOTE = 500

function RequestHandoffs({ request, cardClassName, canPass = false, onPassed }) {
    const [handoffs, setHandoffs] = useState([])
    const [names, setNames] = useState({})
    const [handedByNames, setHandedByNames] = useState({})
    const [loading, setLoading] = useState(true)
    const [unavailable, setUnavailable] = useState(false)

    const [staff, setStaff] = useState([])
    const [pickedStage, setStage] = useState('')
    const [toEmployeeId, setToEmployeeId] = useState('')
    const [note, setNote] = useState('')
    const [passing, setPassing] = useState(false)

    const requestId = request?.request_id
    const atClaimingStage = CLAIMING_STATUSES.includes(request?.status)

    const loadHandoffs = async () => {
        if (!requestId) return

        const { data, error } = await supabase
            .from('request_handoffs')
            .select('handoff_id, from_employee_id, to_employee_id, stage, note, handed_by, request_status, created_at')
            .eq('request_id', requestId)
            .order('created_at', { ascending: true })

        if (error) {
            // Table not created yet (migration pending): hide the section.
            if (error.code === 'PGRST205' || error.code === '42P01') setUnavailable(true)
            else console.error('LOAD HANDOFFS ERROR:', error)
            setLoading(false)
            return
        }

        const rows = data || []
        const [employeeNames, handedBy] = await Promise.all([
            loadEmployeeNames([...rows.flatMap((h) => [h.from_employee_id, h.to_employee_id]), request.assigned_employee_id]),
            loadDirectoryProfiles(rows.map((h) => h.handed_by)),
        ])

        setUnavailable(false)
        setHandoffs(rows)
        setNames(employeeNames)
        setHandedByNames(Object.fromEntries(handedBy.map((p) => [p.user_id, `${p.first_name || ''} ${p.last_name || ''}`.trim()])))
        setLoading(false)
    }

    // Active employees who can receive the request, with names.
    const loadStaff = async () => {
        const { data: employees } = await supabase
            .from('employees')
            .select('employee_id, status')
            .eq('status', 'active')

        const employeeNames = await loadEmployeeNames((employees || []).map((e) => e.employee_id))
        setStaff(
            Object.entries(employeeNames)
                .map(([employeeId, info]) => ({ employeeId, ...info }))
                .sort((a, b) => a.name.localeCompare(b.name))
        )
    }

    useEffect(() => {
        loadHandoffs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestId, request?.assigned_employee_id])

    useEffect(() => {
        if (canPass) loadStaff()
    }, [canPass])

    useLiveRefresh(['request_handoffs'], () => loadHandoffs())

    if (unavailable || !requestId) return null

    // Default to the next sensible step for where the request is now; the
    // claiming section only once the request is ready for claiming.
    const stage = pickedStage && (pickedStage !== 'claiming' || atClaimingStage)
        ? pickedStage
        : atClaimingStage ? 'claiming' : 'production'

    const candidates = staff.filter((s) =>
        s.employeeId !== request.assigned_employee_id &&
        (stage === 'claiming' ? s.scope === 'releasing' : s.scope !== 'releasing')
    )

    const pass = async () => {
        const target = staff.find((s) => s.employeeId === toEmployeeId)
        if (!target) {
            notifyError('Pick who to pass this request to.')
            return
        }

        const confirmed = await confirmModal(
            `Pass request ${request.request_number} to ${target.name} for ${HANDOFF_STAGES[stage].toLowerCase()}? They become the one handling it${canPass === 'head' ? '' : ', and it leaves your list'}.`,
            { title: 'Pass this request?', confirmButtonText: 'Pass request' }
        )
        if (!confirmed) return

        try {
            setPassing(true)
            const { error } = await supabase.rpc('handoff_request', {
                p_request_id: requestId,
                p_to_employee_id: toEmployeeId,
                p_stage: stage,
                p_note: note.trim() || null,
            })
            if (error) throw error

            setNote('')
            notifySuccess(`Request passed to ${target.name}.`)
            onPassed?.(target)
            loadHandoffs()
        } catch (err) {
            console.error('HANDOFF ERROR:', err)
            notifyError(friendlyError(err, 'Failed to pass the request.'))
        } finally {
            setPassing(false)
        }
    }

    const current = names[request.assigned_employee_id]

    return (
        <section className={cardClassName}>
            <div className="rh-head">
                <div>
                    <h2 style={{ fontSize: 16, margin: 0 }}>Handling</h2>
                    <p className="rh-sub">
                        {current
                            ? <>Currently handled by <strong>{current.name}</strong>{current.scope === 'releasing' ? ' (claiming section)' : ''}.</>
                            : 'Not assigned to anyone yet.'}
                    </p>
                </div>
                {handoffs.length > 0 && <span className="rh-count">{handoffs.length}</span>}
            </div>

            {loading ? (
                <p className="rh-sub">Loading handling history...</p>
            ) : handoffs.length === 0 ? (
                <p className="rh-sub">No hand-offs recorded yet.</p>
            ) : (
                <ol className="rh-timeline">
                    {handoffs.map((h) => {
                        const from = names[h.from_employee_id]
                        const to = names[h.to_employee_id]
                        return (
                            <li key={h.handoff_id} className="rh-item">
                                <span className={`rh-stage rh-stage-${h.stage}`}>{HANDOFF_STAGES[h.stage] || h.stage}</span>
                                <div className="rh-body">
                                    <div>
                                        {from ? <><strong>{from.name}</strong> → </> : null}
                                        <strong>{to?.name || 'Employee'}</strong>
                                        {to?.scope === 'releasing' && <span className="rh-sub"> (claiming section)</span>}
                                    </div>
                                    {h.note && <div className="rh-note">“{h.note}”</div>}
                                    <div className="rh-meta">
                                        {formatDisplayDateTime(h.created_at)}
                                        {handedByNames[h.handed_by] ? ` · by ${handedByNames[h.handed_by]}` : ''}
                                        {h.request_status ? ` · status: ${h.request_status.replace(/_/g, ' ')}` : ''}
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ol>
            )}

            {canPass && (
                <div className="rh-composer">
                    <strong style={{ fontSize: 14 }}>Pass this request on</strong>

                    <div className="rh-stages" role="radiogroup" aria-label="Pass for">
                        {['processing', 'production', 'claiming'].map((value) => {
                            const disabled = value === 'claiming' && !atClaimingStage
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={stage === value}
                                    className={`rh-chip${stage === value ? ' is-active' : ''}`}
                                    disabled={disabled || passing}
                                    title={disabled ? 'Available once the request is Ready for Claiming' : undefined}
                                    onClick={() => { setStage(value); setToEmployeeId('') }}
                                >
                                    {HANDOFF_STAGES[value]}
                                </button>
                            )
                        })}
                    </div>

                    {!atClaimingStage && (
                        <span className="rh-sub">Claiming section opens once the request is Ready for Claiming.</span>
                    )}

                    <select
                        className="rh-field"
                        value={toEmployeeId}
                        onChange={(e) => setToEmployeeId(e.target.value)}
                        disabled={passing}
                        aria-label="Pass to"
                    >
                        <option value="">
                            {candidates.length
                                ? stage === 'claiming' ? '-- Choose claiming section staff --' : '-- Choose an employee --'
                                : stage === 'claiming' ? 'No active claiming section staff' : 'No other active employees'}
                        </option>
                        {candidates.map((s) => (
                            <option key={s.employeeId} value={s.employeeId}>
                                {s.name}{s.position ? ` — ${s.position}` : ''}
                            </option>
                        ))}
                    </select>

                    <textarea
                        className="rh-field"
                        rows={2}
                        maxLength={MAX_NOTE}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Note for the next person (optional) — e.g. printed, needs dry seal"
                        disabled={passing}
                    />

                    <div>
                        <button
                            type="button"
                            className={cardClassName === 'admin-card' ? 'admin-primary-button' : 'employee-primary-button'}
                            onClick={pass}
                            disabled={passing || !toEmployeeId}
                        >
                            {passing ? 'Passing...' : 'Pass request'}
                        </button>
                    </div>
                </div>
            )}
        </section>
    )
}

export default RequestHandoffs
