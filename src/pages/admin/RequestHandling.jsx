import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SkeletonTable } from '../../components/Skeleton'
import PageStats from '../../components/PageStats'
import { HANDOFF_STAGES, loadEmployeeNames } from '../../lib/requestHandoffs'
import '../../components/RequestHandoffs.css'
import { loadDirectoryProfiles } from '../../lib/directoryProfiles'
import { IconCalendarCheck, IconUsers, IconSwap, IconPackage } from './icons'
import './AdminPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { adminPath } from '../../lib/portalPaths'

const formatDate = (value) =>
    new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const isToday = (value) => new Date(value).toDateString() === new Date().toDateString()

// Every change of who handles a request -- the head's assignments and the
// employees' hand-offs (processing -> production -> claiming section) --
// newest first. Per-request trails are also on each request's page.
function RequestHandling() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [unavailable, setUnavailable] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [stageFilter, setStageFilter] = useState('')

    useLiveRefresh(['request_handoffs'], (options) => loadHandoffs(options))

    useEffect(() => {
        loadHandoffs()
    }, [])

    const loadHandoffs = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data, error: handoffError } = await supabase
                .from('request_handoffs')
                .select('handoff_id, request_id, from_employee_id, to_employee_id, stage, note, handed_by, request_status, created_at')
                .order('created_at', { ascending: false })
                .limit(1000)

            if (handoffError) {
                if (handoffError.code === 'PGRST205' || handoffError.code === '42P01') {
                    setUnavailable(true)
                    return
                }
                throw new Error('Failed to load request handling: ' + handoffError.message)
            }

            const handoffs = data || []
            const requestIds = [...new Set(handoffs.map((h) => h.request_id))]

            const [{ data: requests }, names, handedBy] = await Promise.all([
                requestIds.length
                    ? supabase.from('document_requests').select('request_id, request_number, status').in('request_id', requestIds)
                    : Promise.resolve({ data: [] }),
                loadEmployeeNames(handoffs.flatMap((h) => [h.from_employee_id, h.to_employee_id])),
                loadDirectoryProfiles(handoffs.map((h) => h.handed_by)),
            ])

            const requestById = Object.fromEntries((requests || []).map((r) => [r.request_id, r]))
            const handedByName = Object.fromEntries(handedBy.map((p) => [p.user_id, `${p.first_name || ''} ${p.last_name || ''}`.trim()]))

            setUnavailable(false)
            setRows(handoffs.map((h) => ({
                ...h,
                requestNumber: requestById[h.request_id]?.request_number || 'Deleted request',
                currentStatus: requestById[h.request_id]?.status || '',
                fromName: names[h.from_employee_id]?.name || '',
                toName: names[h.to_employee_id]?.name || 'Employee',
                toIsClaiming: names[h.to_employee_id]?.scope === 'releasing',
                byName: handedByName[h.handed_by] || '',
            })))
        } catch (err) {
            console.error('REQUEST HANDLING ERROR:', err)
            setError(err.message || 'Failed to load request handling.')
        } finally {
            setLoading(false)
        }
    }

    const passes = rows.filter((r) => r.stage !== 'assigned')
    const staffInvolved = new Set(rows.flatMap((r) => [r.fromName, r.toName]).filter(Boolean)).size

    const visibleRows = rows.filter((row) => {
        if (stageFilter && row.stage !== stageFilter) return false
        if (!search.trim()) return true
        const term = search.trim().toLowerCase()
        return [row.requestNumber, row.fromName, row.toName, row.byName, row.note]
            .some((value) => (value || '').toLowerCase().includes(term))
    })

    return (
        <div>
            <div className="admin-page-header">
                <h1>Request Handling</h1>
                <p>Who has handled each request: your assignments and every hand-off between employees, from processing and production to the claiming section.</p>
            </div>

            {unavailable ? (
                <div className="admin-empty">
                    Request handling isn&apos;t set up on the database yet. Once the request hand-off migration is applied, every hand-off appears here.
                </div>
            ) : (
                <>
                    {(
                        <PageStats
                            loading={loading}
                            stats={[
                                { label: 'Hand-offs', value: passes.length, note: 'Passed between employees', Icon: IconSwap },
                                { label: 'Today', value: rows.filter((r) => isToday(r.created_at)).length, note: 'Handling changes today', Icon: IconCalendarCheck },
                                { label: 'To claiming', value: rows.filter((r) => r.stage === 'claiming').length, note: 'Passed to the claiming section', Icon: IconPackage },
                                { label: 'Staff involved', value: staffInvolved, note: 'Employees who handled requests', Icon: IconUsers },
                            ]}
                        />
                    )}

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                        <input
                            className="admin-search-input admin-search-field"
                            style={{ flex: 1, minWidth: 220 }}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by request number, employee, or note"
                            aria-label="Search request handling"
                        />

                        <select
                            className="admin-search-input"
                            style={{ maxWidth: 220 }}
                            value={stageFilter}
                            onChange={(e) => setStageFilter(e.target.value)}
                            aria-label="Filter by stage"
                        >
                            <option value="">All stages</option>
                            {Object.entries(HANDOFF_STAGES).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {error && <div className="admin-error-box">{error}</div>}

                    {loading ? (
                        <SkeletonTable portal="admin" columns={['When', 'Request', 'Stage', 'From → To', 'Note', 'By']} rows={6} />
                    ) : visibleRows.length === 0 ? (
                        <div className="admin-empty">
                            {rows.length === 0 ? 'No request has been assigned or passed on yet.' : 'Nothing matches this search.'}
                        </div>
                    ) : (
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>When</th>
                                        <th>Request</th>
                                        <th>Stage</th>
                                        <th>From → To</th>
                                        <th>Note</th>
                                        <th>By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleRows.map((row) => (
                                        <tr key={row.handoff_id}>
                                            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(row.created_at)}</td>
                                            <td>
                                                <Link to={adminPath(`/requests/${row.request_id}`)}><strong>{row.requestNumber}</strong></Link>
                                                {row.currentStatus && <div style={{ fontSize: 12, opacity: 0.75 }}>Now: {row.currentStatus.replace(/_/g, ' ')}</div>}
                                            </td>
                                            <td><span className={`rh-stage rh-stage-${row.stage}`}>{HANDOFF_STAGES[row.stage] || row.stage}</span></td>
                                            <td>
                                                {row.fromName ? <>{row.fromName} → </> : null}
                                                <strong>{row.toName}</strong>
                                                {row.toIsClaiming && <div style={{ fontSize: 12, opacity: 0.75 }}>Claiming section</div>}
                                            </td>
                                            <td>{row.note || '—'}</td>
                                            <td>{row.byName || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default RequestHandling
