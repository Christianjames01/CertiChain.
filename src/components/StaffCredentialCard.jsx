import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { downloadDigitalCopy } from '../lib/digitalCopy'
import { revokeCredential } from '../lib/revokeCredential'
import { startBlockchainRecording } from '../lib/anchorCredentials'
import { confirmWithPassword } from '../lib/confirmPassword'
import { blockedForReadOnlyViewer } from '../lib/viewOnlyGuard'
import { confirmModal, notifyError, notifySuccess, notifyWarning } from '../lib/notify'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import Modal from './Modal'
import './StaffCredentialCard.css'

const EMAIL_LABEL = {
    unsent: ['Not sent yet', 'muted'],
    pending: ['Sending to the student…', 'pending'],
    sent: ['Emailed to the student', 'good'],
    failed: ['Email not sent yet — retrying', 'warn'],
    disabled: ['Not sent yet', 'muted'],
    skipped: ['Not sent yet', 'muted'],
}

const when = (value) => (value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '')

function StaffCredentialCard({ requestId, requestNumber, role, cardClassName = 'employee-card' }) {
    const [credential, setCredential] = useState(null)
    const [busy, setBusy] = useState('')
    const [revokeOpen, setRevokeOpen] = useState(false)
    const [reason, setReason] = useState('')

    const load = useCallback(async () => {
        const { data } = await supabase
            .from('credentials')
            .select('credential_id, credential_number, student_id, status, generated_at, revoked_at, revocation_reason, chain_status, digital_seal_code, digital_file_path, digital_email_status, digital_emailed_at, digital_email_error')
            .eq('request_id', requestId)
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        setCredential(data || null)
    }, [requestId])

    useEffect(() => {
        load()
    }, [load])

    useLiveRefresh(['credentials'], load)

    if (!credential) return null

    const revoked = credential.status === 'revoked'
    const [emailText, emailTone] = EMAIL_LABEL[credential.digital_email_status] || ['—', 'muted']

    const resend = async () => {
        if (blockedForReadOnlyViewer(role)) return
        const again = credential.digital_email_status === 'sent'
        const ok = await confirmModal(
            again
                ? 'The student already received this PDF. Send it to their email again?'
                : 'Email the sealed digital copy (PDF) of this credential to the student now?',
            { title: again ? 'Send again?' : 'Send the digital copy?', confirmButtonText: 'Send', cancelButtonText: 'Cancel' },
        )
        if (!ok) return
        setBusy('resend')
        const { error } = await supabase.rpc('resend_digital_copy', { p_credential_id: credential.credential_id })
        setBusy('')
        if (error) {
            notifyError(error.message || 'Could not queue the email.')
            return
        }
        startBlockchainRecording()
        notifySuccess('The digital copy will be emailed to the student within a minute.')
        load()
    }

    const revoke = async () => {
        if (blockedForReadOnlyViewer(role)) return
        if (!reason.trim()) {
            notifyWarning('Please enter a reason for revoking this credential.')
            return
        }
        const verified = await confirmWithPassword({
            title: 'Confirm with your password',
            text: `Enter your password to revoke credential ${credential.credential_number}.`,
        })
        if (!verified) return
        try {
            setBusy('revoke')
            const { data: { user } } = await supabase.auth.getUser()
            const { data: employee } = await supabase.from('employees').select('employee_id').eq('user_id', user?.id).maybeSingle()
            await revokeCredential({
                credentialId: credential.credential_id,
                credentialNumber: credential.credential_number,
                requestNumber: requestNumber || '',
                studentId: credential.student_id,
                reason: reason.trim(),
                employeeId: employee?.employee_id || null,
                userId: user?.id || null,
            })
            notifySuccess(`${credential.credential_number} revoked. The student is notified by email, and the blockchain record is updated.`)
            setRevokeOpen(false)
            setReason('')
            load()
        } catch (err) {
            console.error('REVOKE CREDENTIAL ERROR:', err)
            notifyError(err.message || 'Could not revoke the credential.')
        } finally {
            setBusy('')
        }
    }

    return (
        <div className={`${cardClassName} scc`}>
            <div className="scc-head">
                <h2>Digital Credential</h2>
                <span className={`scc-pill is-${revoked ? 'bad' : 'good'}`}>{revoked ? 'Revoked' : 'Valid'}</span>
            </div>

            <dl className="scc-grid">
                <div><dt>Credential number</dt><dd className="is-mono">{credential.credential_number}</dd></div>
                <div><dt>Generated</dt><dd>{when(credential.generated_at)}</dd></div>
                <div><dt>Blockchain</dt><dd>{credential.chain_status === 'recorded' ? 'Recorded on ICP' : 'Being recorded…'}</dd></div>
                <div>
                    <dt>Digital copy (PDF)</dt>
                    <dd>{credential.digital_seal_code ? <span className="is-mono">{credential.digital_seal_code}</span> : 'Being created…'}</dd>
                </div>
                {!revoked && credential.digital_file_path && (
                    <div className="is-wide">
                        <dt>Email to student</dt>
                        <dd className={`scc-email is-${emailTone}`}>
                            {emailText}{credential.digital_email_status === 'sent' && credential.digital_emailed_at ? ` · ${when(credential.digital_emailed_at)}` : ''}
                            {credential.digital_email_status === 'failed' && credential.digital_email_error && <small>{credential.digital_email_error}</small>}
                        </dd>
                    </div>
                )}
                {revoked && (
                    <div className="is-wide">
                        <dt>Revoked</dt>
                        <dd>{when(credential.revoked_at)}{credential.revocation_reason ? ` — ${credential.revocation_reason}` : ''}</dd>
                    </div>
                )}
            </dl>

            <div className="scc-actions">
                {credential.digital_file_path && (
                    <button type="button" className="scc-btn" onClick={() => downloadDigitalCopy(credential.digital_file_path, credential.credential_number)}>
                        Download PDF
                    </button>
                )}
                {!revoked && credential.digital_file_path && (
                    <button type="button" className={credential.digital_email_status === 'sent' ? 'scc-btn' : 'scc-btn is-primary'} onClick={resend} disabled={busy === 'resend' || credential.digital_email_status === 'pending'}>
                        {busy === 'resend' ? 'Sending…' : credential.digital_email_status === 'sent' ? 'Send again' : credential.digital_email_status === 'pending' ? 'Sending…' : 'Send PDF to student'}
                    </button>
                )}
                {!revoked && role !== 'superadmin' && (
                    <button type="button" className="scc-danger" onClick={() => setRevokeOpen(true)}>
                        Revoke credential
                    </button>
                )}
            </div>

            {revokeOpen && (
                <Modal title="Revoke credential" subtitle={credential.credential_number} maxWidth={460} onClose={() => { if (!busy) setRevokeOpen(false) }}>
                    <p style={{ fontSize: 14, marginBottom: 12 }}>
                        Revoking makes this credential and its digital copy show as <strong>revoked</strong> to anyone who verifies it.
                        The student is told by email. This cannot be undone.
                    </p>
                    <label className="form-label" htmlFor="scc-reason">Reason</label>
                    <textarea id="scc-reason" className="form-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy === 'revoke'} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                        <button type="button" className="scc-btn" onClick={() => setRevokeOpen(false)} disabled={busy === 'revoke'}>Cancel</button>
                        <button type="button" className="scc-danger" onClick={revoke} disabled={busy === 'revoke'}>
                            {busy === 'revoke' ? 'Revoking…' : 'Revoke'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

export default StaffCredentialCard
