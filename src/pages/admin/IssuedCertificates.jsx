import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonTable } from '../../components/Skeleton'
import PageStats from '../../components/PageStats'
import { IconCalendarCheck, IconUsers, IconFileStack, IconBarChart } from './icons'
import './AdminPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'

const initialsOf = (name) =>
    (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?'

const ROLE_LABELS = { employee: 'Employee', registrar_head: 'Registrar Head', admin: 'Admin', superadmin: 'Superadmin' }

const localDateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayKey = () => localDateKey(new Date())
const monthKey = () => todayKey().slice(0, 7)

const formatDate = (value) =>
    new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function IssuedCertificates() {
    const [certificates, setCertificates] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [issuerFilter, setIssuerFilter] = useState('')

    useLiveRefresh(['enrollment_certificates'], (options) => loadCertificates(options))

    useEffect(() => {
        loadCertificates()
    }, [])

    const loadCertificates = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const columns = 'certificate_id, student_name, program, year_level, semester, school_year, purpose, or_number, cert_number, issued_date, issued_by, created_at'
            const fetchCertificates = (select) => supabase
                .from('enrollment_certificates')
                .select(select)
                .order('created_at', { ascending: false })
                .limit(5000)

            let { data, error: certError } = await fetchCertificates(`${columns}, encoder_initials`)

            if (certError && /encoder_initials/.test(certError.message || '')) {
                ;({ data, error: certError } = await fetchCertificates(columns))
            }

            if (certError) {
                throw new Error('Failed to load issued certificates: ' + certError.message)
            }

            const rows = data || []
            const userIds = [...new Set(rows.map((c) => c.issued_by).filter(Boolean))]

            const { data: profiles } = userIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name, role').in('user_id', userIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))

            setCertificates(
                rows.map((cert) => {
                    const profile = profileByUserId[cert.issued_by]
                    return {
                        ...cert,
                        issuerName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown staff',
                        issuerRole: profile ? ROLE_LABELS[profile.role] || '' : '',
                    }
                })
            )
        } catch (err) {
            console.error('ISSUED CERTIFICATES ERROR:', err)
            setError(err.message || 'Failed to load issued certificates.')
        } finally {
            setLoading(false)
        }
    }

    const today = todayKey()
    const month = monthKey()
    const issuedOn = (cert) => localDateKey(new Date(cert.created_at))

    const byIssuer = {}
    for (const cert of certificates) {
        const key = cert.issued_by || 'unknown'
        const entry = byIssuer[key] || (byIssuer[key] = {
            userId: key,
            name: cert.issuerName,
            role: cert.issuerRole,
            total: 0,
            today: 0,
            month: 0,
            last: cert.created_at,
        })
        entry.total += 1
        if (issuedOn(cert) === today) entry.today += 1
        if (issuedOn(cert).startsWith(month)) entry.month += 1
        if (cert.created_at > entry.last) entry.last = cert.created_at
    }
    const issuers = Object.values(byIssuer).sort((a, b) => b.total - a.total)

    const todayCount = certificates.filter((c) => issuedOn(c) === today).length
    const monthCount = certificates.filter((c) => issuedOn(c).startsWith(month)).length

    const visibleCertificates = certificates.filter((cert) => {
        if (issuerFilter && cert.issued_by !== issuerFilter) return false
        if (!search.trim()) return true
        const term = search.trim().toLowerCase()
        return [cert.student_name, cert.program, cert.purpose, cert.or_number, cert.cert_number, cert.issuerName, cert.encoder_initials]
            .some((value) => (value || '').toLowerCase().includes(term))
    })

    return (
        <div>
            <div className="admin-page-header">
                <h1>Issued Certificates</h1>
                <p>Every Certificate of Enrollment saved &amp; printed by registrar staff, and how many each one has issued.</p>
            </div>

            {(
                <PageStats
                    loading={loading}
                    stats={[
                        { label: 'Total issued', value: certificates.length, note: 'All certificates saved & printed', Icon: IconFileStack },
                        { label: 'Today', value: todayCount, note: 'Issued today', Icon: IconCalendarCheck },
                        { label: 'This month', value: monthCount, note: new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }), Icon: IconBarChart },
                        { label: 'Staff issuing', value: issuers.length, note: 'Employees who issued at least one', Icon: IconUsers },
                    ]}
                />
            )}

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <SkeletonTable portal="admin" columns={['Issued by', 'Total', 'Today', 'This month', 'Last issued', '']} rows={3} />
            ) : certificates.length === 0 ? (
                <div className="admin-empty">No certificates have been saved &amp; printed yet.</div>
            ) : (
                <>
                    <h2 style={{ fontSize: 18, margin: '8px 0 12px' }}>By employee</h2>
                    <div className="admin-table-wrapper" style={{ marginBottom: 28 }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Issued by</th>
                                    <th>Total</th>
                                    <th>Today</th>
                                    <th>This month</th>
                                    <th>Last issued</th>
                                    <th aria-label="Filter" />
                                </tr>
                            </thead>
                            <tbody>
                                {issuers.map((issuer) => (
                                    <tr key={issuer.userId}>
                                        <td>
                                            <span className="log-actor">
                                                <span className="admin-avatar" aria-hidden="true">{initialsOf(issuer.name)}</span>
                                                <span>
                                                    <strong>{issuer.name}</strong>
                                                    {issuer.role && <small>{issuer.role}</small>}
                                                </span>
                                            </span>
                                        </td>
                                        <td><strong>{issuer.total}</strong></td>
                                        <td>{issuer.today}</td>
                                        <td>{issuer.month}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(issuer.last)}</td>
                                        <td>
                                            <button
                                                className="admin-secondary-button"
                                                onClick={() => setIssuerFilter(issuerFilter === issuer.userId ? '' : issuer.userId)}
                                            >
                                                {issuerFilter === issuer.userId ? 'Show all' : 'View list'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h2 style={{ fontSize: 18, margin: '8px 0 12px' }}>
                        {issuerFilter ? `Certificates issued by ${byIssuer[issuerFilter]?.name || 'this employee'}` : 'All certificates'}
                    </h2>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                        <input
                            className="admin-search-input admin-search-field"
                            style={{ flex: 1, minWidth: 220 }}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by student, program, purpose, OR / cert number or encoder initials"
                            aria-label="Search issued certificates"
                        />

                        <select
                            className="admin-search-input"
                            style={{ maxWidth: 260 }}
                            value={issuerFilter}
                            onChange={(e) => setIssuerFilter(e.target.value)}
                            aria-label="Filter by employee"
                        >
                            <option value="">All employees</option>
                            {issuers.map((issuer) => (
                                <option key={issuer.userId} value={issuer.userId}>{issuer.name} ({issuer.total})</option>
                            ))}
                        </select>
                    </div>

                    {visibleCertificates.length === 0 ? (
                        <div className="admin-empty">No certificates match this search.</div>
                    ) : (
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Student</th>
                                        <th>Program</th>
                                        <th>Purpose</th>
                                        <th>OR No.</th>
                                        <th>Cert No.</th>
                                        <th>Issued by</th>
                                        <th>Saved &amp; printed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleCertificates.map((cert) => (
                                        <tr key={cert.certificate_id}>
                                            <td>
                                                <strong>{cert.student_name}</strong>
                                                <div style={{ fontSize: 12, opacity: 0.75 }}>{cert.year_level} · {cert.semester}, S.Y. {cert.school_year}</div>
                                            </td>
                                            <td>{cert.program}</td>
                                            <td>{cert.purpose}</td>
                                            <td>{cert.or_number || '—'}</td>
                                            <td>{cert.cert_number || '—'}</td>
                                            <td>
                                                {cert.issuerName}
                                                {cert.encoder_initials && (
                                                    <div style={{ fontSize: 12, opacity: 0.75 }}>Encoder initials: {cert.encoder_initials}</div>
                                                )}
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(cert.created_at)}</td>
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

export default IssuedCertificates
