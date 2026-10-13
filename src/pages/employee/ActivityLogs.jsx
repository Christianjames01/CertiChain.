import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonTable } from '../../components/Skeleton'
import HighlightedText from '../../components/HighlightedText'
import PageStats from '../../components/PageStats'
import { IconHistory } from './icons'
import { IconCalendarCheck, IconBarChart } from '../admin/icons'
import './EmployeePages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'

function ActivityLogs() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [filterDate, setFilterDate] = useState('')

    useLiveRefresh(['activity_logs'], (options) => loadLogs(options))

    useEffect(() => {
        loadLogs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterDate])

    const loadLogs = async ({ silent = false } = {}) => {
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

            const { data: employee, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('user_id', user.id)
                .single()

            if (employeeError || !employee) {
                throw new Error('Employee record could not be found.')
            }

            let query = supabase
                .from('activity_logs')
                .select('activity_log_id, action, table_name, record_id, description, created_at')
                .eq('employee_id', employee.employee_id)
                .order('created_at', { ascending: false })

            if (filterDate) {
                const dayStart = new Date(`${filterDate}T00:00:00`)
                const dayEnd = new Date(`${filterDate}T23:59:59.999`)
                query = query
                    .gte('created_at', dayStart.toISOString())
                    .lte('created_at', dayEnd.toISOString())
                    .limit(2000)
            } else {
                query = query.limit(200)
            }

            const { data, error: logsError } = await query

            if (logsError) {
                throw new Error('Failed to load activity logs: ' + logsError.message)
            }

            setLogs(data || [])

        } catch (err) {
            console.error('ACTIVITY LOGS ERROR:', err)
            setError(err.message || 'Failed to load activity logs.')
        } finally {
            setLoading(false)
        }
    }

    const visibleLogs = logs.filter((log) => {
        if (!search.trim()) return true
        const term = search.trim().toLowerCase()
        return (
            log.action.toLowerCase().includes(term) ||
            (log.description || '').toLowerCase().includes(term)
        )
    })

    const formatDate = (value) =>
        new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

    const todayCount = logs.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length
    const actionCounts = {}
    for (const l of logs) actionCounts[l.action] = (actionCounts[l.action] || 0) + 1
    const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]

    return (
        <div>
            <div className="employee-page-header">
                <h1>Activity Logs</h1>
                <p>
                    {filterDate
                        ? `Every action you took on ${new Date(`${filterDate}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}.`
                        : 'Your 200 most recent actions on requests, receipts, requirements, and claim schedules. Pick a date below to see every action from a specific day.'}
                </p>
            </div>

            {(loading || logs.length > 0) && (
                <PageStats
                    loading={loading}
                    stats={[
                        { label: filterDate ? 'Actions that day' : 'Your actions', value: logs.length, note: filterDate ? 'Every recorded action' : 'Latest 200', Icon: IconHistory },
                        { label: 'Today', value: todayCount, note: 'Recorded today', Icon: IconCalendarCheck },
                        { label: 'Most common', value: topAction ? topAction[1] : 0, note: topAction ? topAction[0].replace(/_/g, ' ') : '—', Icon: IconBarChart },
                    ]}
                />
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <input
                    className="employee-search-input ui-search-field"
                    style={{ flex: 1, minWidth: 220 }}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by action or description"
                    aria-label="Search activity logs"
                />

                <input
                    className="employee-search-input"
                    style={{ maxWidth: 200 }}
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    aria-label="Filter by date"
                    max={new Date().toISOString().slice(0, 10)}
                />

                {filterDate && (
                    <button className="employee-secondary-button" onClick={() => setFilterDate('')}>
                        Show recent instead
                    </button>
                )}
            </div>

            {error && <div className="employee-error-box">{error}</div>}

            {loading ? (
                <SkeletonTable portal="employee" columns={['Action', 'Description', 'Date']} rows={8} />
            ) : logs.length === 0 && !filterDate ? (
                <div className="employee-empty">
                    No activity has been recorded yet. Actions you take (verifying payments,
                    approving requirements, processing requests, scheduling claims) will
                    appear here.
                </div>
            ) : visibleLogs.length === 0 ? (
                <div className="employee-empty">
                    {filterDate && !search.trim() ? 'No activity recorded on this date.' : 'No activity matches this search.'}
                </div>
            ) : (
                <div className="employee-table-wrapper">
                    <table className="employee-table">
                        <thead>
                            <tr>
                                <th>Action</th>
                                <th>Description</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleLogs.map((log) => (
                                <tr key={log.activity_log_id}>
                                    <td><span className="ui-log-action">{log.action.replace(/_/g, ' ')}</span></td>
                                    <td>{log.description ? <HighlightedText text={log.description} /> : (log.table_name ? `on ${log.table_name}` : '')}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default ActivityLogs
