import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { notifyError, notifySuccess } from '../../lib/notify'
import { friendlyError } from '../../lib/friendlyError'
import hcdcLogo from '../../assets/hcdc-logo.png'
import './EmployeePages.css'
import './CertificateOfEnrollment.css'

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

function CertificateOfEnrollment() {
    const [programs, setPrograms] = useState([])
    const [registrarOptions, setRegistrarOptions] = useState([])
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        studentName: '',
        yearLevel: YEAR_LEVELS[0],
        program: '',
        semester: SEMESTERS[0],
        schoolYear: defaultSchoolYear(),
        purpose: '',
        registrarName: '',
        issuedDate: new Date().toISOString().slice(0, 10),
        orNumber: '',
        certNumber: '',
    })

    useEffect(() => {
        loadLookups()
    }, [])

    const loadLookups = async () => {
        const [{ data: programRows }, { data: profiles }] = await Promise.all([
            supabase.from('programs').select('program_name').eq('status', 'active').order('program_name'),
            supabase.from('profiles').select('first_name, last_name').eq('role', 'registrar_head').eq('status', 'active'),
        ])

        setPrograms((programRows || []).map((p) => p.program_name))

        const names = (profiles || []).map((p) => `${p.first_name} ${p.last_name}`.trim().toUpperCase())
        setRegistrarOptions(names)
        if (names.length > 0) {
            setForm((f) => (f.registrarName ? f : { ...f, registrarName: names[0] }))
        }
    }

    const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

    const canSave = form.studentName.trim() && form.program.trim() && form.purpose.trim() && form.registrarName.trim()

    const saveAndPrint = async () => {
        if (!canSave) {
            notifyError('Fill in the student name, program, purpose, and registrar name first.')
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
                registrar_name: form.registrarName.trim(),
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

                    <label className="coe-label" htmlFor="coe-registrar">Registrar Name</label>
                    {registrarOptions.length > 0 ? (
                        <select id="coe-registrar" className="employee-search-input" value={form.registrarName} onChange={update('registrarName')}>
                            {registrarOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    ) : (
                        <input id="coe-registrar" className="employee-search-input" value={form.registrarName} onChange={update('registrarName')} />
                    )}

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
                        <div className="coe-header">
                            <img src={hcdcLogo} alt="Holy Cross of Davao College" width="84" height="84" />
                        </div>

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

                        <div className="coe-signature">
                            <strong>{form.registrarName || '_______________'}</strong>
                            <span>Registrar</span>
                        </div>

                        <div className="coe-footer">
                            <img src={hcdcLogo} alt="" className="coe-footer-seal" aria-hidden="true" />
                            <div className="coe-footer-text">
                                <p>Not Valid w/out School Seal</p>
                                <p>OR No.: {form.orNumber || '__________'}</p>
                                <p>Cert No.: {form.certNumber || '__________'}</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}

export default CertificateOfEnrollment
