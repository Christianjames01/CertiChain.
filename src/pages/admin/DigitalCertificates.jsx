import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { newSealCode, sealPrintedDocument } from '../../lib/documentSeal'
import { fileFingerprint, fileSizeText, shortFingerprint, MAX_CERTIFICATE_MB } from '../../lib/fileFingerprint'
import { logActivity } from '../../lib/activityLog'
import { blockedForReadOnlyViewer } from '../../lib/viewOnlyGuard'
import { notifyError, notifySuccess } from '../../lib/notify'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import '../auth/Auth.css'
import './AdminPages.css'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp'
const EMPTY = { title: '', holder: '', issuedOn: '', issuer: 'Holy Cross of Davao College', description: '' }

const formatWhen = (value) => (value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const formatDay = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—')

function DigitalCertificates() {
    const { role } = useOutletContext() || {}
    const fileRef = useRef(null)
    const [form, setForm] = useState(EMPTY)
    const [file, setFile] = useState(null)
    const [fingerprint, setFingerprint] = useState('')
    const [hashing, setHashing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [sealed, setSealed] = useState(null)
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')

    const load = async () => {
        const { data, error } = await supabase
            .from('document_seals')
            .select('seal_code, title, student_name, content, issued_at, chain_status, chain_tx_hash, chain_recorded_at, chain_attempts')
            .eq('doc_type', 'digital')
            .order('issued_at', { ascending: false })
            .limit(300)
        if (error) console.error('DIGITAL CERTIFICATES LOAD ERROR:', error)
        setRows(data || [])
        setLoading(false)
    }

    useEffect(() => {
        load()
    }, [])

    useLiveRefresh(['document_seals'], load)

    const pickFile = async (picked) => {
        setSealed(null)
        setFingerprint('')
        setFile(null)
        if (!picked) return
        if (picked.size > MAX_CERTIFICATE_MB * 1024 * 1024) {
            notifyError(`The file is larger than ${MAX_CERTIFICATE_MB} MB.`)
            return
        }
        try {
            setHashing(true)
            setFile(picked)
            setFingerprint(await fileFingerprint(picked))
        } catch (err) {
            console.error('FINGERPRINT ERROR:', err)
            notifyError('Could not read this file.')
            setFile(null)
        } finally {
            setHashing(false)
        }
    }

    const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

    const seal = async (e) => {
        e.preventDefault()
        if (blockedForReadOnlyViewer(role)) return
        if (!file || !fingerprint) {
            notifyError('Choose the certificate file first.')
            return
        }
        if (!form.title.trim() || !form.holder.trim()) {
            notifyError('Enter the certificate title and who it was issued to.')
            return
        }
        const existing = rows.find((r) => r.content?.file_sha256 === fingerprint)
        if (existing) {
            notifyError(`This exact file is already sealed as ${existing.seal_code}.`)
            return
        }
        const code = newSealCode()
        setSaving(true)
        const error = await sealPrintedDocument({
            code,
            docType: 'digital',
            title: form.title.trim(),
            studentName: form.holder.trim(),
            content: {
                file_sha256: fingerprint,
                file_name: file.name,
                file_size: file.size,
                file_type: file.type || 'application/octet-stream',
                issued_on: form.issuedOn || null,
                issuer: form.issuer.trim() || null,
                description: form.description.trim() || null,
            },
        })
        setSaving(false)
        if (error) {
            console.error('SEAL DIGITAL CERTIFICATE ERROR:', error)
            notifyError(/duplicate|unique/i.test(error.message || '')
                ? 'This exact file is already sealed.'
                : 'The certificate could not be sealed. Please try again.')
            return
        }
        const { data: { user } } = await supabase.auth.getUser()
        await logActivity({
            userId: user?.id,
            action: 'seal_digital_certificate',
            tableName: 'document_seals',
            recordId: null,
            description: `Sealed the digital certificate "${form.title.trim()}" for ${form.holder.trim()} as ${code} (file ${file.name}).`,
        })
        setSealed({ code, title: form.title.trim(), fileName: file.name })
        notifySuccess(`${code} sealed. It will be recorded on the Internet Computer within a minute.`)
        setForm(EMPTY)
        setFile(null)
        setFingerprint('')
        if (fileRef.current) fileRef.current.value = ''
        load()
    }

    const q = query.trim().toLowerCase()
    const visible = q
        ? rows.filter((r) => `${r.seal_code} ${r.title} ${r.student_name} ${r.content?.file_name || ''}`.toLowerCase().includes(q))
        : rows

    const verifyBase = `${window.location.origin}/verify`

    return (
        <div>
            <header className="admin-page-header">
                <h1>Digital Certificates</h1>
                <p>
                    Seal a certificate that already exists as a digital file (PDF or image). Its SHA-256 fingerprint is recorded on
                    the Internet Computer, so anyone can later upload the same file on the verify page and see that it is genuine
                    and unchanged. The file itself is never uploaded or stored.
                </p>
            </header>

            {role !== 'superadmin' && (
                <form className="admin-card" onSubmit={seal} style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 16, marginBottom: 14 }}>Seal a certificate</h2>

                    <div className="form-group">
                        <label className="form-label" htmlFor="dc-file">Certificate file</label>
                        <input id="dc-file" ref={fileRef} type="file" accept={ACCEPT} className="form-input" onChange={(e) => pickFile(e.target.files?.[0])} disabled={saving} />
                        <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--slate)' }}>
                            {hashing
                                ? 'Computing the fingerprint…'
                                : file && fingerprint
                                    ? <>{file.name} · {fileSizeText(file.size)} · SHA-256 <span style={{ fontFamily: 'monospace' }} title={fingerprint}>{shortFingerprint(fingerprint)}</span></>
                                    : `PDF, PNG, JPG or WEBP, up to ${MAX_CERTIFICATE_MB} MB. Use the exact file that will be given out.`}
                        </small>
                    </div>

                    <div className="admin-info-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 0 }}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="dc-title">Certificate title</label>
                            <input id="dc-title" className="form-input" placeholder="e.g. Certificate of Participation" value={form.title} onChange={update('title')} disabled={saving} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="dc-holder">Issued to</label>
                            <input id="dc-holder" className="form-input" placeholder="Full name" value={form.holder} onChange={update('holder')} disabled={saving} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="dc-date">Issued on</label>
                            <input id="dc-date" type="date" className="form-input" value={form.issuedOn} onChange={update('issuedOn')} disabled={saving} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="dc-issuer">Issued by</label>
                            <input id="dc-issuer" className="form-input" value={form.issuer} onChange={update('issuer')} disabled={saving} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="dc-desc">Description (optional)</label>
                        <input id="dc-desc" className="form-input" placeholder="e.g. Regional IT Summit 2026, Davao City" value={form.description} onChange={update('description')} disabled={saving} />
                    </div>

                    <button type="submit" className="admin-primary-button" disabled={saving || hashing || !fingerprint}>
                        {saving ? 'Sealing…' : 'Seal on the blockchain'}
                    </button>

                    {sealed && (
                        <div className="admin-notice tone-success" style={{ marginTop: 14 }}>
                            <strong>{sealed.code} sealed</strong>
                            <p>
                                Share the code or the link <a href={`${verifyBase}/${sealed.code}`} target="_blank" rel="noreferrer">{verifyBase}/{sealed.code}</a>.
                                Anyone can also open <a href={verifyBase} target="_blank" rel="noreferrer">{verifyBase}</a> and upload {sealed.fileName} to check it.
                            </p>
                        </div>
                    )}
                </form>
            )}

            <div className="admin-card">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h2 style={{ fontSize: 16 }}>Sealed certificates <span style={{ color: 'var(--slate)', fontWeight: 500 }}>({rows.length})</span></h2>
                    <input type="search" className="admin-search-input" placeholder="Search code, title, name or file…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 240 }} />
                </div>
                {loading ? (
                    <p className="admin-empty">Loading…</p>
                ) : visible.length === 0 ? (
                    <p className="admin-empty">{rows.length ? 'No certificates match your search.' : 'No digital certificates have been sealed yet.'}</p>
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Certificate</th>
                                    <th>Issued to</th>
                                    <th>File</th>
                                    <th>Blockchain</th>
                                    <th>Sealed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((r) => (
                                    <tr key={r.seal_code}>
                                        <td style={{ fontFamily: 'monospace' }}>
                                            <a href={`${verifyBase}/${r.seal_code}`} target="_blank" rel="noreferrer">{r.seal_code}</a>
                                        </td>
                                        <td>
                                            {r.title}
                                            {r.content?.issued_on && <small style={{ display: 'block', color: 'var(--slate)' }}>Issued {formatDay(r.content.issued_on)}</small>}
                                        </td>
                                        <td>{r.student_name}</td>
                                        <td>
                                            {r.content?.file_name}
                                            <small style={{ display: 'block', color: 'var(--slate)', fontFamily: 'monospace' }} title={r.content?.file_sha256}>{shortFingerprint(r.content?.file_sha256)}</small>
                                        </td>
                                        <td>
                                            <span className={`admin-status-pill status-${r.chain_status === 'recorded' ? 'active' : r.chain_status === 'failed' && r.chain_attempts >= 10 ? 'rejected' : 'pending'}`}>
                                                {r.chain_status === 'recorded' ? 'Recorded' : r.chain_status === 'failed' ? 'Retrying' : 'Pending'}
                                            </span>
                                        </td>
                                        <td>{formatWhen(r.issued_at)}</td>
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
