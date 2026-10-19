import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { shortFingerprint } from '../../lib/fileFingerprint'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { downloadDigitalCopy } from '../../components/DigitalCopyButton'
import './AdminPages.css'

const formatWhen = (value) => (value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const chainTone = (r) => (r.chain_status === 'recorded' ? 'active' : r.chain_status === 'failed' && r.chain_attempts >= 10 ? 'rejected' : 'pending')
const chainLabel = (r) => (r.chain_status === 'recorded' ? 'Recorded' : r.chain_status === 'failed' ? 'Retrying' : 'Pending')

function DigitalCertificates() {
    const [rows, setRows] = useState([])
    const [waiting, setWaiting] = useState(0)
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')

    const load = async () => {
        const [{ data, error }, { count }] = await Promise.all([
            supabase
                .from('document_seals')
                .select('seal_code, title, student_name, content, issued_at, chain_status, chain_attempts')
                .eq('doc_type', 'digital')
                .order('issued_at', { ascending: false })
                .limit(500),
            supabase
                .from('credentials')
                .select('credential_id', { count: 'exact', head: true })
                .eq('status', 'generated')
                .is('digital_seal_code', null),
        ])
        if (error) console.error('DIGITAL CERTIFICATES LOAD ERROR:', error)
        setRows(data || [])
        setWaiting(count || 0)
        setLoading(false)
    }

    useEffect(() => {
        load()
    }, [])

    useLiveRefresh(['document_seals', 'credentials'], load)

    const q = query.trim().toLowerCase()
    const visible = q
        ? rows.filter((r) => `${r.seal_code} ${r.title} ${r.student_name} ${r.content?.credential_number || ''}`.toLowerCase().includes(q))
        : rows

    const verifyBase = `${window.location.origin}/verify`

    return (
        <div>
            <header className="admin-page-header">
                <h1>Digital Certificates</h1>
                <p>
                    Every credential the Registrar generates gets an official digital copy (PDF) automatically. CertiChain creates
                    the file, records its SHA-256 fingerprint on the Internet Computer, and gives the student a download. Anyone can
                    upload that PDF on the verify page to confirm it is genuine and unchanged.
                </p>
            </header>

            {waiting > 0 && (
                <div className="admin-notice tone-info" style={{ marginBottom: 16 }}>
                    {waiting} credential{waiting === 1 ? ' is' : 's are'} waiting for a digital copy. They are created automatically, a few each minute.
                </div>
            )}

            <div className="admin-card">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h2 style={{ fontSize: 16 }}>Sealed digital copies <span style={{ color: 'var(--slate)', fontWeight: 500 }}>({rows.length})</span></h2>
                    <input type="search" className="admin-search-input" placeholder="Search code, credential, title or name…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 240 }} />
                </div>
                {loading ? (
                    <p className="admin-empty">Loading…</p>
                ) : visible.length === 0 ? (
                    <p className="admin-empty">{rows.length ? 'No digital copies match your search.' : 'No digital copies yet. One is created automatically each time a credential is generated.'}</p>
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Credential</th>
                                    <th>Issued to</th>
                                    <th>File fingerprint</th>
                                    <th>Blockchain</th>
                                    <th>Sealed</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((r) => (
                                    <tr key={r.seal_code}>
                                        <td style={{ fontFamily: 'monospace' }}>
                                            <a href={`${verifyBase}/${r.seal_code}`} target="_blank" rel="noreferrer">{r.seal_code}</a>
                                        </td>
                                        <td>
                                            {r.content?.description || r.title}
                                            {r.content?.credential_number && <small style={{ display: 'block', color: 'var(--slate)', fontFamily: 'monospace' }}>{r.content.credential_number}</small>}
                                        </td>
                                        <td>{r.student_name}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12 }} title={r.content?.file_sha256}>{shortFingerprint(r.content?.file_sha256)}</td>
                                        <td><span className={`admin-status-pill status-${chainTone(r)}`}>{chainLabel(r)}</span></td>
                                        <td>{formatWhen(r.issued_at)}</td>
                                        <td>
                                            {r.content?.file_path && (
                                                <button type="button" className="admin-link-button" onClick={() => downloadDigitalCopy(r.content.file_path, r.content.credential_number)}>
                                                    Download
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

export default DigitalCertificates
