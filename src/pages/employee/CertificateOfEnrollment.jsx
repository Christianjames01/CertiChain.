import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { notifyError, notifySuccess } from '../../lib/notify'
import { friendlyError } from '../../lib/friendlyError'
import hcdcLogo from '../../assets/hcdc-logo.png'
import hcdc75Logo from '../../assets/hcdc-75-logo.png'
import pacucoaLogo from '../../assets/footer-pacucoa.png'
import cocopeaLogo from '../../assets/footer-cocopea.png'
import ceapLogo from '../../assets/footer-ceap.png'
import davaoChamberLogo from '../../assets/footer-davao-chamber.png'
import dacsLogo from '../../assets/footer-dacs.png'
import umapLogo from '../../assets/footer-umap.png'
import tuvnordLogo from '../../assets/footer-tuvnord.png'
import eccpLogo from '../../assets/footer-eccp.png'
import erasmusLogo from '../../assets/footer-erasmus.png'
import dacunLogo from '../../assets/footer-dacun.png'
import './EmployeePages.css'
import './CertificateOfEnrollment.css'

const MEMBERSHIP_LOGOS = [
    { src: cocopeaLogo, alt: 'COCOPEA' },
    { src: ceapLogo, alt: 'Catholic Educational Association of the Philippines' },
    { src: dacsLogo, alt: 'Davao Association of Catholic Schools' },
    { src: dacunLogo, alt: 'Davao Colleges and Universities Network' },
    { src: umapLogo, alt: 'University Mobility in Asia and the Pacific' },
    { src: erasmusLogo, alt: 'Erasmus+' },
    { src: eccpLogo, alt: 'European Chamber of Commerce of the Philippines' },
    { src: davaoChamberLogo, alt: 'Davao City Chamber of Commerce and Industry Foundation' },
]

const YEAR_LEVELS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Fifth Year']
const SEMESTERS = ['First Semester', 'Second Semester', 'Summer']

// School year "starts" in June -- before that, we're still in the previous
// one (e.g. February 2027 is still S.Y. 2026-2027).
const defaultSchoolYear = () => {
    const now = new Date()
    const y = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
    return `${y}-${y + 1}`
}

const ordinal = (n) => {
    const v = n % 100
    if (v >= 11 && v <= 13) return `${n}th`
    return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`
}

// The Registrar's signature is always Mrs. Yee -- not a choice of
// whichever registrar_head account happens to be active (that list
// includes non-signatory admin/dev accounts too).
const REGISTRAR_NAME = 'MRS. JENNIFER C. YEE'

function CertificateOfEnrollment() {
    const [programs, setPrograms] = useState([])
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        studentName: '',
        yearLevel: YEAR_LEVELS[0],
        program: '',
        semester: SEMESTERS[0],
        schoolYear: defaultSchoolYear(),
        purpose: '',
        issuedDate: new Date().toISOString().slice(0, 10),
        orNumber: '',
        certNumber: '',
    })

    useEffect(() => {
        loadLookups()
    }, [])

    const loadLookups = async () => {
        const { data: programRows } = await supabase
            .from('programs')
            .select('program_name')
            .eq('status', 'active')
            .order('program_name')

        setPrograms((programRows || []).map((p) => p.program_name))
    }

    const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

    const canSave = form.studentName.trim() && form.program.trim() && form.purpose.trim()

    const saveAndPrint = async () => {
        if (!canSave) {
            notifyError('Fill in the student name, program, and purpose first.')
            return
        }

        try {
            setSaving(true)
            const { data: { user } } = await supabase.auth.getUser()

            const { error } = await supabase.from('enrollment_certificates').insert({
                student_name: form.studentName.trim(),
                program: form.program.trim(),
                year_level: form.yearLevel,
                semester: form.semester,
                school_year: form.schoolYear.trim(),
                purpose: form.purpose.trim(),
                registrar_name: REGISTRAR_NAME,
                or_number: form.orNumber.trim() || null,
                cert_number: form.certNumber.trim() || null,
                issued_date: form.issuedDate,
                issued_by: user.id,
            })

            if (error) throw error

            notifySuccess('Certificate logged.')
            window.print()
        } catch (err) {
            console.error('SAVE CERTIFICATE ERROR:', err)
            notifyError(friendlyError(err, 'Failed to save the certificate.'))
        } finally {
            setSaving(false)
        }
    }

    const issuedDateObj = form.issuedDate ? new Date(`${form.issuedDate}T00:00:00`) : new Date()
    const issuedDayLabel = `${ordinal(issuedDateObj.getDate())} day of ${issuedDateObj.toLocaleDateString('en-PH', { month: 'long' })}, ${issuedDateObj.getFullYear()}`
    const yearAdjective = form.yearLevel.toLowerCase().replace(' ', '-')

    return (
        <div>
            <header className="employee-page-header">
                <h1>Certificate of Enrollment</h1>
                <p>Fill in the student's details, then save and print — matches the Registrar's standard certification format (ORRM CF-004C).</p>
            </header>

            <div className="coe-layout">
                <section className="employee-card coe-form">
                    <h2 style={{ fontSize: 16, marginBottom: 4 }}>Details</h2>

                    <label className="coe-label" htmlFor="coe-student-name">Student Name</label>
                    <input
                        id="coe-student-name"
                        className="employee-search-input"
                        placeholder="e.g. DELA CRUZ, JUAN C."
                        value={form.studentName}
                        onChange={update('studentName')}
                    />

                    <label className="coe-label" htmlFor="coe-year-level">Year Level</label>
                    <select id="coe-year-level" className="employee-search-input" value={form.yearLevel} onChange={update('yearLevel')}>
                        {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <label className="coe-label" htmlFor="coe-program">Program</label>
                    {programs.length > 0 ? (
                        <select id="coe-program" className="employee-search-input" value={form.program} onChange={update('program')}>
                            <option value="">-- Select program --</option>
                            {programs.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                    ) : (
                        <input
                            id="coe-program"
                            className="employee-search-input"
                            placeholder="e.g. Bachelor of Science in Marine Transportation"
                            value={form.program}
                            onChange={update('program')}
                        />
                    )}

                    <label className="coe-label" htmlFor="coe-semester">Semester</label>
                    <select id="coe-semester" className="employee-search-input" value={form.semester} onChange={update('semester')}>
                        {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <label className="coe-label" htmlFor="coe-sy">School Year</label>
                    <input id="coe-sy" className="employee-search-input" placeholder="e.g. 2026-2027" value={form.schoolYear} onChange={update('schoolYear')} />

                    <label className="coe-label" htmlFor="coe-purpose">Purpose</label>
                    <input
                        id="coe-purpose"
                        className="employee-search-input"
                        placeholder="e.g. CHED-TDP scholarship purposes only"
                        value={form.purpose}
                        onChange={update('purpose')}
                    />

                    <label className="coe-label" htmlFor="coe-date">Issued Date</label>
                    <input id="coe-date" type="date" className="employee-search-input" value={form.issuedDate} onChange={update('issuedDate')} />

                    <div className="coe-row-2">
                        <div>
                            <label className="coe-label" htmlFor="coe-or">OR Number</label>
                            <input id="coe-or" className="employee-search-input" placeholder="e.g. 008421" value={form.orNumber} onChange={update('orNumber')} />
                        </div>
                        <div>
                            <label className="coe-label" htmlFor="coe-cert">Cert Number</label>
                            <input id="coe-cert" className="employee-search-input" placeholder="e.g. 2026076" value={form.certNumber} onChange={update('certNumber')} />
                        </div>
                    </div>

                    <button className="employee-primary-button" style={{ marginTop: 20 }} onClick={saveAndPrint} disabled={saving || !canSave}>
                        {saving ? 'Saving...' : 'Save & Print'}
                    </button>
                </section>

                <section className="coe-preview-wrap">
                    <div className="coe-preview" id="coe-print-area">
                        <div className="coe-letterhead">
                            <img src={hcdcLogo} alt="Holy Cross of Davao College" className="coe-letterhead-seal" width="84" height="84" />

                            <div className="coe-letterhead-text">
                                <h1>Holy Cross of Davao College, Inc.</h1>
                                <p className="coe-letterhead-office">Office of Registration and Records Management</p>
                                <p>Sta. Ana Avenue corner C. De Guzman Street, Brgy. 14-B, Davao City, Philippines</p>
                                <p>Tel. No. (082) 221 – 9071 to 79 loc. 116 &amp; 167 • Telefax: (082) 221-3008</p>
                                <p>Cellphone No.: (+63) 9468108617 &amp; (+63) 9061509582</p>
                                <p>Email: registrar@hcdc.edu.ph • Website: http://www.hcdc.edu.ph/</p>
                            </div>

                            <img src={hcdc75Logo} alt="HCDC 75th Diamond Jubilee" className="coe-letterhead-75" width="64" height="70" />
                        </div>
                        <div className="coe-letterhead-rule" aria-hidden="true" />

                        <h2 className="coe-title">C E R T I F I C A T I O N</h2>

                        <p className="coe-salutation">TO WHOM IT MAY CONCERN:</p>

                        <p className="coe-body">
                            THIS IS TO CERTIFY that <strong>{form.studentName.trim() || '_______________'}</strong>, a{' '}
                            {yearAdjective} student in <strong>{(form.program || '_______________').toUpperCase()}</strong>{' '}
                            of HOLY CROSS OF DAVAO COLLEGE, INC., is officially enrolled this {form.semester}, S.Y. {form.schoolYear || '_______'}.
                        </p>

                        <p className="coe-body">
                            This certification is issued upon the request of the aforesaid person for {form.purpose.trim() || '_______________'}.
                        </p>

                        <p className="coe-body">
                            Issued this {issuedDayLabel} in Davao City, Philippines.
                        </p>

                        <div className="coe-spacer" aria-hidden="true" />

                        <div className="coe-signoff">
                            <div className="coe-footer">
                                <p>Not Valid w/out:</p>
                                <p>School Seal</p>
                                <p>OR No.: {form.orNumber || '__________'}</p>
                                <p>Cert No.: {form.certNumber || '__________'}</p>
                            </div>

                            <div className="coe-signature">
                                <strong>{REGISTRAR_NAME}</strong>
                                <span>Registrar</span>
                            </div>
                        </div>

                        <div className="coe-page-footer">
                            <div className="coe-accreditation-rule" aria-hidden="true" />

                            <div className="coe-accreditation">
                                <div className="coe-accreditation-col">
                                    <span className="coe-accreditation-label">Accredited:</span>
                                    <img src={pacucoaLogo} alt="PACU / PACUCOA" className="coe-accreditation-wide" />
                                </div>

                                <div className="coe-accreditation-col is-wide">
                                    <span className="coe-accreditation-label">Institutional Membership:</span>
                                    <div className="coe-accreditation-row">
                                        {MEMBERSHIP_LOGOS.map((logo) => (
                                            <img key={logo.alt} src={logo.src} alt={logo.alt} />
                                        ))}
                                    </div>
                                </div>

                                <div className="coe-accreditation-col">
                                    <span className="coe-accreditation-label">Certified: ISO 21001:2018</span>
                                    <img src={tuvnordLogo} alt="TÜV NORD" className="coe-accreditation-wide" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}

export default CertificateOfEnrollment
