import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { notifyError, notifySuccess } from '../../lib/notify'
import { friendlyError } from '../../lib/friendlyError'
import PageStats from '../../components/PageStats'
import { IconFileStack, IconCalendarCheck } from '../admin/icons'
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

// Same order as the Registrar's printed letterhead, left to right.
const MEMBERSHIP_LOGOS = [
    { src: ceapLogo, alt: 'Catholic Educational Association of the Philippines' },
    { src: cocopeaLogo, alt: 'COCOPEA' },
    { src: davaoChamberLogo, alt: 'Davao City Chamber of Commerce and Industry Foundation' },
    { src: dacsLogo, alt: 'Davao Association of Catholic Schools' },
    { src: dacunLogo, alt: 'Davao Colleges and Universities Network' },
    { src: umapLogo, alt: 'University Mobility in Asia and the Pacific' },
    { src: eccpLogo, alt: 'European Chamber of Commerce of the Philippines' },
    { src: erasmusLogo, alt: 'Erasmus+' },
]

// The preview is laid out at real US Letter size (8.5in = 816 CSS px) so
// the printout matches it exactly; on screen it's zoomed to fit its column.
const PAGE_WIDTH_PX = 816

// The sheet carries its own margins, so the printer page must have none.
const PRINT_PAGE_RULE = '@page { size: letter; margin: 0; }'

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

// "purposes only." is fixed text on the form, so drop it if typed in.
const stripPurposeSuffix = (text) => text.trim().replace(/\s*purposes?\s+only\.?$/i, '')

// Wraps hyphenated words so the line never breaks at the hyphen.
const keepHyphens = (text) =>
    text.split(/(\S*-\S*)/).map((part, i) => (i % 2 ? <span key={i} className="coe-nowrap">{part}</span> : part))

// A form fill-in value, bolded where the template bolds it.
const Fill = ({ children, bold }) => (
    <span className="coe-fill">{bold ? <strong>{children}</strong> : children}</span>
)

function CertificateOfEnrollment() {
    const [programs, setPrograms] = useState([])
    const [saving, setSaving] = useState(false)
    const [previewScale, setPreviewScale] = useState(1)
    const [myCounts, setMyCounts] = useState(null)
    const previewWrapRef = useRef(null)

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
        encoderInitials: '',
    })

    useEffect(() => {
        loadLookups()
        loadMyCounts()
    }, [])

    useEffect(() => {
        const wrap = previewWrapRef.current
        if (!wrap) return
        const observer = new ResizeObserver(([entry]) => {
            setPreviewScale(Math.min(1, entry.contentRect.width / PAGE_WIDTH_PX))
        })
        observer.observe(wrap)
        return () => observer.disconnect()
    }, [])

    const loadLookups = async () => {
        const { data: programRows } = await supabase
            .from('programs')
            .select('program_name')
            .eq('status', 'active')
            .order('program_name')

        setPrograms((programRows || []).map((p) => p.program_name))
    }

    // How many certificates this staff member has saved & printed, overall
    // and today (local date). The registrar head sees everyone's tally on
    // the head portal's Issued Certificates page.
    const loadMyCounts = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        const [{ count: total }, { count: todayCount }] = await Promise.all([
            supabase.from('enrollment_certificates').select('certificate_id', { count: 'exact', head: true }).eq('issued_by', user.id),
            supabase.from('enrollment_certificates').select('certificate_id', { count: 'exact', head: true }).eq('issued_by', user.id).gte('created_at', new Date(`${today}T00:00:00`).toISOString()),
        ])

        setMyCounts({ total: total || 0, today: todayCount || 0 })
    }

    const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

    const purposeText = stripPurposeSuffix(form.purpose)
    const canSave = form.studentName.trim() && form.program.trim() && purposeText

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
                purpose: `${purposeText} purposes only`,
                registrar_name: REGISTRAR_NAME,
                or_number: form.orNumber.trim() || null,
                cert_number: form.certNumber.trim() || null,
                issued_date: form.issuedDate,
                issued_by: user.id,
            })

            if (error) throw error

            // Print before showing the notice: while a SweetAlert modal is
            // open it aria-hides the rest of <body>, and its print CSS then
            // hides those elements -- the certificate included.
            window.print()
            loadMyCounts()
            notifySuccess('Certificate logged.')
        } catch (err) {
            console.error('SAVE CERTIFICATE ERROR:', err)
            notifyError(friendlyError(err, 'Failed to save the certificate.'))
        } finally {
            setSaving(false)
        }
    }

    const issuedDateObj = form.issuedDate ? new Date(`${form.issuedDate}T00:00:00`) : new Date()
    const issuedDay = issuedDateObj.getDate()
    const issuedMonthYear = `${issuedDateObj.toLocaleDateString('en-PH', { month: 'long' })}, ${issuedDateObj.getFullYear()}`
    const yearAdjective = form.yearLevel.toLowerCase().replace(' ', '-')

    // The sheet is rendered twice: zoomed in the on-screen preview, and at
    // full size in a print-only copy portalled straight under <body>. The
    // dashboard's sticky / overflow-hidden containers clip anything printed
    // from inside them, which left the printout blank.
    const sheet = (
        <>
                <div className="coe-letterhead">
                    <img src={hcdcLogo} alt="Holy Cross of Davao College" className="coe-letterhead-seal" />

                    <div className="coe-letterhead-text">
                        <h1>Holy Cross of Davao College</h1>
                        <p className="coe-letterhead-office">Office of&nbsp; Registrar and Records Management</p>
                        <p>Sta. Ana Avenue corner C. De Guzman Street, Brgy. 14-B, Davao City, Philippines</p>
                        <p>Tel. No. (082) 221 – 9071 to 79 loc. 116 &amp; 167 • Telefax: (082) 221-3008</p>
                        <p>
                            Email: : registrar<span className="coe-link">@hcdc.edu.ph </span> • Website:{' '}
                            <span className="coe-link">http://www.hcdc.edu.ph/</span>
                        </p>
                    </div>

                    <img src={hcdc75Logo} alt="HCDC 75th Diamond Jubilee" className="coe-letterhead-75" />
                </div>

                <div className="coe-rule" aria-hidden="true" />

                <h2 className="coe-title">C E R T I F I C A T I O N</h2>

                <p className="coe-salutation">TO WHOM IT MAY CONCERN:</p>

                <p className="coe-body">
                    THIS IS TO CERTIFY that <Fill bold>{form.studentName.trim().toUpperCase() || '_______________'}</Fill>,{' '}
                    <Fill>{keepHyphens(yearAdjective)}</Fill> student in <Fill bold>{(form.program.trim() || '_______________').toUpperCase()}</Fill>{' '}
                    of HOLY CROSS OF DAVAO COLLEGE, INC., <Fill>is</Fill> officially enrolled{' '}
                    <Fill>this {form.semester}, S.Y. {form.schoolYear.trim() || '_______'}</Fill>.
                </p>

                <p className="coe-body">
                    This certification is issued upon the request of the aforesaid person for{' '}
                    <Fill>{purposeText ? keepHyphens(purposeText) : '_______________'}</Fill> purposes only.
                </p>

                <p className="coe-body">
                    Issued this <Fill>{issuedDay}<sup>{ordinal(issuedDay).slice(-2)}</sup> day of {issuedMonthYear}</Fill> in Davao City, Philippines.
                </p>

                <div className="coe-note">
                    <p>Not Valid w/out</p>
                    <p>School Seal</p>
                    <p>OR No.: <Fill>{form.orNumber.trim() || '__________'}</Fill></p>
                    <p>Cert No.: <Fill>{form.certNumber.trim() || '__________'}</Fill></p>
                    {form.encoderInitials.trim() && <p><em>//{form.encoderInitials.trim()}</em></p>}
                </div>

                <div className="coe-signature">
                    <strong>{REGISTRAR_NAME}</strong>
                    <span>Registrar</span>
                </div>

                <div className="coe-page-footer">
                    <div className="coe-rule" aria-hidden="true" />

                    <div className="coe-accreditation">
                        <div className="coe-accreditation-col">
                            <span className="coe-accreditation-label">Accredited:</span>
                            <img src={pacucoaLogo} alt="PACU / PACUCOA" className="coe-accreditation-pacucoa" />
                        </div>

                        <div className="coe-accreditation-col">
                            <span className="coe-accreditation-label">Institutional Member of:</span>
                            <div className="coe-accreditation-row">
                                {MEMBERSHIP_LOGOS.map((logo) => (
                                    <img key={logo.alt} src={logo.src} alt={logo.alt} />
                                ))}
                            </div>
                        </div>

                        <div className="coe-accreditation-col">
                            <span className="coe-accreditation-label">Certified: ISO 21001:2018</span>
                            <img src={tuvnordLogo} alt="TÜV NORD" className="coe-accreditation-tuv" />
                        </div>
                    </div>
                </div>
        </>
    )

    return (
        <div>
            <style>{PRINT_PAGE_RULE}</style>

            <header className="employee-page-header">
                <h1>Certificate of Enrollment</h1>
                <p>Fill in the student's details, then save and print — matches the Registrar's standard certification format (ORRM CF-004C).</p>
            </header>

            {myCounts && (
                <PageStats
                    stats={[
                        { label: 'You have issued', value: myCounts.total, note: 'Certificates saved & printed', Icon: IconFileStack },
                        { label: 'Today', value: myCounts.today, note: 'Saved & printed today', Icon: IconCalendarCheck },
                    ]}
                />
            )}

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
                        placeholder="e.g. CHED-TDP scholarship"
                        value={form.purpose}
                        onChange={update('purpose')}
                    />
                    <span className="coe-hint">Printed as “for ___ purposes only.”</span>

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

                    <label className="coe-label" htmlFor="coe-initials">Encoder Initials</label>
                    <input
                        id="coe-initials"
                        className="employee-search-input"
                        placeholder="e.g. yul"
                        value={form.encoderInitials}
                        onChange={update('encoderInitials')}
                    />

                    <button className="employee-primary-button" style={{ marginTop: 20 }} onClick={saveAndPrint} disabled={saving || !canSave}>
                        {saving ? 'Saving...' : 'Save & Print'}
                    </button>
                </section>

                <section className="coe-preview-wrap" ref={previewWrapRef}>
                    <div className="coe-preview" style={{ zoom: previewScale }}>
                        {sheet}
                    </div>
                </section>
            </div>

            {createPortal(
                <div className="coe-print-root">
                    <div className="coe-preview">{sheet}</div>
                </div>,
                document.body,
            )}
        </div>
    )
}

export default CertificateOfEnrollment
