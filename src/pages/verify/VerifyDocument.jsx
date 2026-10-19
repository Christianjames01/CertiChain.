import { useState } from 'react'
import { fileFingerprint, fileSizeText } from '../../lib/fileFingerprint'

const formatDay = (value) =>
    value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

const formatDate = (value) =>
    value ? new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

function Field({ label, value, wide, mono }) {
    if (!value) return null
    return (
        <div className={wide ? 'is-wide' : undefined}>
            <dt>{label}</dt>
            <dd className={mono ? 'is-mono' : undefined}>{value}</dd>
        </div>
    )
}

function CompareFile({ expected }) {
    const [state, setState] = useState(null)
    const compare = async (file) => {
        if (!file) return
        setState({ busy: true, name: file.name })
        try {
            const hash = await fileFingerprint(file)
            setState({ name: file.name, match: hash === expected })
        } catch (err) {
            console.error('COMPARE FILE ERROR:', err)
            setState({ name: file.name, error: true })
        }
    }
    const tone = state && !state.busy && !state.error ? (state.match ? ' is-match' : ' is-mismatch') : ''
    return (
        <div className={`verify-compare${tone}`}>
            <label className="verify-file-pick is-inline">
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => { compare(e.target.files?.[0]); e.target.value = '' }} />
                <span><strong>Compare your copy</strong> — choose the certificate file you received</span>
            </label>
            {state?.busy && <p>Checking {state.name}…</p>}
            {state && !state.busy && (
                <p>
                    {state.error
                        ? 'This file could not be read.'
                        : state.match
                            ? <><strong>{state.name}</strong> is the original sealed file, unchanged.</>
                            : <><strong>{state.name}</strong> does not match. It is a different or edited file, so do not accept it as this certificate.</>}
                </p>
            )}
        </div>
    )
}

function VerifyDocument({ result, fileCheck }) {
    const d = result.details || {}
    if (result.doc_type === 'digital') {
        const fileLine = d.file_name ? [d.file_name, d.file_size ? fileSizeText(d.file_size) : ''].filter(Boolean).join(' · ') : ''
        return (
            <>
                <dl className="verify-fields">
                    <Field label="Document number" value={result.credential_number} mono />
                    <Field label="Digital copy of credential" value={result.linked_credential || d.credential_number} mono />
                    <Field label="Issued to" value={result.student_name} />
                    <Field label="Issued on" value={formatDay(d.issued_on)} />
                    <Field label="Issued by" value={d.issuer} wide />
                    <Field label="Details" value={d.description} wide />
                    <Field label="Original file" value={fileLine} wide />
                    <Field label="File fingerprint (SHA-256)" value={d.file_sha256} wide mono />
                    <Field label="Sealed on" value={formatDate(result.generated_at)} />
                </dl>
                {fileCheck?.hash && fileCheck.hash === d.file_sha256 ? (
                    <div className="verify-compare is-match">
                        <p><strong>{fileCheck.name}</strong> is the original sealed file, unchanged.</p>
                    </div>
                ) : (
                    <CompareFile expected={d.file_sha256} />
                )}
            </>
        )
    }
    const isTor = result.doc_type === 'tor'
    const courses = Array.isArray(d.courses) ? d.courses : []
    const courseCount = courses.filter((c) => !c.heading).length

    return (
        <>
            <dl className="verify-fields">
                <Field label="Document number" value={result.credential_number} mono />
                <Field label="Issued to" value={result.student_name} />
                {isTor ? (
                    <>
                        <Field label="Student ID" value={d.student_number} mono />
                        <Field label="OTR No." value={d.otr_no} mono />
                        <Field label="Program" value={d.college} wide />
                        <Field label="Remarks" value={d.remarks} />
                        <Field label="Prepared on" value={formatDay(d.prepared_date)} />
                    </>
                ) : (
                    <>
                        <Field label="Program" value={d.program} wide />
                        <Field label="Year level" value={d.year_level} />
                        <Field label="Semester" value={[d.semester, d.school_year && `S.Y. ${d.school_year}`].filter(Boolean).join(', ')} />
                        <Field label="Purpose" value={d.purpose} wide />
                        <Field label="Issued on" value={formatDay(d.issued_date)} />
                        <Field label="Cert No." value={d.cert_number} mono />
                        <Field label="OR No." value={d.or_number} mono />
                    </>
                )}
                <Field label="Printed and sealed" value={formatDate(result.generated_at)} />
            </dl>

            {isTor && courseCount > 0 && (
                <details className="verify-courses">
                    <summary>Courses and grades on this transcript ({courseCount})</summary>
                    <p>Compare these with the printed transcript. Any difference means the paper was changed.</p>
                    <div className="verify-courses-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Course</th>
                                    <th>Descriptive title</th>
                                    <th>Final</th>
                                    <th>Units</th>
                                </tr>
                            </thead>
                            <tbody>
                                {courses.map((c, i) => (c.heading ? (
                                    <tr key={i} className="is-heading"><td colSpan={4}>{c.heading}</td></tr>
                                ) : (
                                    <tr key={i}>
                                        <td className="is-mono">{c.code}</td>
                                        <td>{c.title}</td>
                                        <td>{c.completion ? `${c.final} / ${c.completion}` : c.final}</td>
                                        <td>{c.units}</td>
                                    </tr>
                                )))}
                            </tbody>
                        </table>
                    </div>
                    {d.graduated_text && <p className="verify-courses-note">{d.graduated_text}</p>}
                </details>
            )}
        </>
    )
}

export default VerifyDocument
