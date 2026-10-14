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

function VerifyDocument({ result }) {
    const d = result.details || {}
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
