import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { shortFingerprint } from '../../lib/fileFingerprint'
import './AdminPages.css'

const CANDID_UI = 'https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=trzz4-6aaaa-aaaan-q6vhq-cai'
const KIND = { credential: 'Credential', digital: 'Digital copy', coe: 'Printed COE', tor: 'Printed TOR' }

const formatIssued = (value) => (value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '')

function BlockchainRecords() {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState('records')
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(null)

    const load = async () => {
        setLoading(true)
        setError('')
        const { data: result, error: fnError } = await supabase.functions.invoke('chain-records', { body: {} })
        if (fnError) {
            let detail = ''
            try {
                detail = (await fnError.context?.json())?.error || ''
            } catch (err) {
                void err
            }
            setError(detail || 'Could not read the blockchain right now. Please try again.')
        } else {
            setData(result)
        }
        setLoading(false)
    }

    useEffect(() => {
        load()
    }, [])

    const q = query.trim().toLowerCase()
    const records = (data?.records || [])
        .filter((r) => !q || JSON.stringify([r.recordNo, r.label, r.details, r.fingerprint, r.inSystem]).toLowerCase().includes(q))
        .sort((a, b) => b.recordNo - a.recordNo)
    const logs = (data?.logs || [])
        .filter((l) => !q || JSON.stringify(l).toLowerCase().includes(q))
        .sort((a, b) => b.id - a.id)

    return (
        <div>
            <header className="admin-page-header">
                <h1>Blockchain Records</h1>
                <p>
                    Read live from the CertiChain registry canister on the Internet Computer. The blockchain stores only a fingerprint,
                    a readable label and an AES-256 encrypted copy of each document; the details below are decrypted here with the
                    Registrar&apos;s key and are visible only to the Registrar head, admin and superadmin.
                </p>
            </header>

            <div className="admin-filter-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                <button className={`admin-filter-chip${tab === 'records' ? ' active' : ''}`} onClick={() => setTab('records')}>
                    Records {data ? `(${data.records.length})` : ''}
                </button>
                <button className={`admin-filter-chip${tab === 'log' ? ' active' : ''}`} onClick={() => setTab('log')}>
                    Activity log {data ? `(${data.logs.length})` : ''}
                </button>
                <input type="search" className="admin-search-input" placeholder="Search number, document, student, fingerprint…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 260 }} />
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 13 }}>
                    <a href={CANDID_UI} target="_blank" rel="noreferrer">Open in Candid UI ↗</a>
                    {data?.canister && <a href={data.canister} target="_blank" rel="noreferrer">ICP dashboard ↗</a>}
                    <button type="button" className="admin-link-button" onClick={load} disabled={loading}>{loading ? 'Reading…' : 'Refresh'}</button>
                </span>
            </div>

            {error && <div className="admin-notice tone-danger" style={{ marginBottom: 16 }}>{error}</div>}
            {data && !data.decrypting && (
                <div className="admin-notice tone-warning" style={{ marginBottom: 16 }}>
                    The encryption key is not configured, so encrypted copies can&apos;t be decrypted. Labels and fingerprints are still shown.
                </div>
            )}

            <div className="admin-card">
                {loading && !data ? (
                    <p className="admin-empty">Reading the blockchain…</p>
                ) : tab === 'records' ? (
                    records.length === 0 ? <p className="admin-empty">No records found.</p> : (
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Document (on-chain label)</th>
                                        <th>Decrypted details</th>
                                        <th>Status</th>
                                        <th>Recorded</th>
                                        <th>Fingerprint</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((r) => (
                                        <tr key={r.fingerprint} onClick={() => setOpen(open === r.fingerprint ? null : r.fingerprint)} style={{ cursor: 'pointer', verticalAlign: 'top' }}>
                                            <td style={{ fontFamily: 'monospace' }}>{r.recordNo}</td>
                                            <td>
                                                {r.label || <span style={{ color: 'var(--slate)' }}>No label yet</span>}
                                                {r.inSystem && <small style={{ display: 'block', color: 'var(--slate)' }}>{KIND[r.inSystem.kind] || r.inSystem.kind} in CertiChain</small>}
                                            </td>
                                            <td>
                                                {r.details ? (
                                                    <>
                                                        <strong>{r.details.student || '—'}</strong>
                                                        <small style={{ display: 'block' }}>{r.details.document}{r.details.number ? ` · ${r.details.number}` : ''}</small>
                                                        {r.details.program && <small style={{ display: 'block', color: 'var(--slate)' }}>{r.details.program}</small>}
                                                        {r.details.issued && <small style={{ display: 'block', color: 'var(--slate)' }}>Issued {formatIssued(r.details.issued)}</small>}
                                                        <small style={{ display: 'block', color: '#1e8a5f', fontWeight: 700 }}>✓ Decrypted · matches fingerprint</small>
                                                    </>
                                                ) : r.decryptError ? (
                                                    <span style={{ color: '#c8102e' }}>Could not decrypt: {r.decryptError}</span>
                                                ) : (
                                                    <span style={{ color: 'var(--slate)' }}>No encrypted copy stored</span>
                                                )}
                                                {open === r.fingerprint && r.encryptedPreview && (
                                                    <small style={{ display: 'block', marginTop: 6, fontFamily: 'monospace', color: 'var(--slate)', overflowWrap: 'anywhere' }}>
                                                        On-chain encrypted copy ({r.encryptedBytes} bytes): {r.encryptedPreview}
                                                    </small>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`admin-status-pill status-${r.status === 'REVOKED' ? 'rejected' : 'active'}`}>{r.status === 'REVOKED' ? 'Revoked' : 'Valid'}</span>
                                                {r.revoked && <small style={{ display: 'block', color: 'var(--slate)' }}>{r.revoked}</small>}
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{r.recorded}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: 12 }} title={r.fingerprint}>
                                                {open === r.fingerprint ? <span style={{ overflowWrap: 'anywhere' }}>{r.fingerprint}</span> : shortFingerprint(r.fingerprint)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    logs.length === 0 ? <p className="admin-empty">No log entries found.</p> : (
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Log #</th>
                                        <th>Action</th>
                                        <th>Record</th>
                                        <th>Document</th>
                                        <th>Time</th>
                                        <th>Signed by</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((l) => (
                                        <tr key={l.id}>
                                            <td style={{ fontFamily: 'monospace' }}>{l.id}</td>
                                            <td>
                                                <span className={`admin-status-pill status-${l.action === 'REVOKED' ? 'rejected' : l.action === 'RECORDED' ? 'active' : 'pending'}`}>{l.action}</span>
                                            </td>
                                            <td style={{ fontFamily: 'monospace' }}>{l.recordNo ? `#${l.recordNo}` : '—'}</td>
                                            <td>{l.label || <span style={{ color: 'var(--slate)' }}>{l.fingerprint ? shortFingerprint(l.fingerprint) : '—'}</span>}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{l.time}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: 12 }} title={l.by}>{l.by ? `${l.by.slice(0, 11)}…` : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    )
}

export default BlockchainRecords
