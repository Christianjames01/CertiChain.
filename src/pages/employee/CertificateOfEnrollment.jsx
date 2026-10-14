import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { confirmModal, notifyError, notifySuccess, notifyWarning } from '../../lib/notify'
import { newSealCode, sealPrintedDocument } from '../../lib/documentSeal'
import SealQr from '../../components/SealQr'
import { friendlyError } from '../../lib/friendlyError'
import PageStats from '../../components/PageStats'
import { IconFileStack, IconCalendarCheck } from '../admin/icons'
import sealImg from '../../assets/coe/seal.png'
import hcdc75Img from '../../assets/coe/hcdc-75.png'
import pacuImg from '../../assets/coe/pacu.png'
import pacucoaImg from '../../assets/coe/pacucoa.png'
import aunQaImg from '../../assets/coe/aun-qa.png'
import erasmusImg from '../../assets/coe/erasmus.png'
import eccpImg from '../../assets/coe/eccp.png'
import jccmiImg from '../../assets/coe/jccmi.png'
import ceapImg from '../../assets/coe/ceap.png'
import dacsImg from '../../assets/coe/dacs.png'
import tuvnordImg from '../../assets/coe/tuvnord.png'
import './EmployeePages.css'
import './CertificateOfEnrollment.css'

const PLACED_IMAGES = [
    { src: sealImg, alt: 'Holy Cross of Davao College seal', box: [45.0, 37.0, 78.0, 84.1] },
    { src: hcdc75Img, alt: 'HCDC 75 Years of Grace and Growth', box: [480.2, 32.2, 96.1, 96.1] },
    { src: pacuImg, alt: 'PACU', box: [43.9, 720.2, 37.1, 36.0] },
    { src: pacucoaImg, alt: 'PACUCOA', box: [81.5, 719.9, 35.3, 36.0] },
    { src: aunQaImg, alt: 'ASEAN University Network / AUN-QA', box: [136.6, 719.5, 65.6, 35.4] },
    { src: erasmusImg, alt: 'Erasmus+', box: [196.8, 719.9, 109.6, 36.1] },
    { src: eccpImg, alt: 'European Chamber of Commerce of the Philippines', box: [304.8, 720.5, 50.4, 35.2] },
    { src: jccmiImg, alt: 'The Japanese Chamber of Commerce of Mindanao', box: [357.1, 720.1, 36.5, 36.0] },
    { src: ceapImg, alt: 'Catholic Educational Association of the Philippines', box: [395.8, 720.0, 36.0, 36.0] },
    { src: dacsImg, alt: 'Davao Association of Catholic Schools', box: [435.0, 720.2, 36.0, 36.0] },
    { src: tuvnordImg, alt: 'TÜV NORD', box: [503.8, 720.0, 63.6, 36.2] },
]

const placedStyle = ([left, top, width, height]) => ({
    left: `${left}pt`,
    top: `${top}pt`,
    width: `${width}pt`,
    height: `${height}pt`,
})

const smallCaps = (text) =>
    text.split(/([a-z]+)/).map((part, i) => (i % 2 ? <span key={i} className="coe-sc">{part.toUpperCase()}</span> : part))

const PAGE_WIDTH_PX = 816

const PRINT_PAGE_RULE = '@page { size: letter; margin: 0; }'

const YEAR_LEVELS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Fifth Year']
const SEMESTERS = ['First Semester', 'Second Semester', 'Summer']

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

const REGISTRAR_NAME = 'MRS. JENNIFER C. YEE'

const stripPurposeSuffix = (text) => text.trim().replace(/\s*purposes?\s+only\.?$/i, '')

const keepHyphens = (text) =>
    text.split(/(\S*-\S*)/).map((part, i) => (i % 2 ? <span key={i} className="coe-nowrap">{part}</span> : part))

const Fill = ({ children, bold }) => (
    <span className="coe-fill">{bold ? <strong>{children}</strong> : children}</span>
)

function CertificateOfEnrollment() {
    const [programs, setPrograms] = useState([])
    const [saving, setSaving] = useState(false)
    const [previewScale, setPreviewScale] = useState(1)
    const [myCounts, setMyCounts] = useState(null)
    const [sealCode, setSealCode] = useState(() => newSealCode())
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

        window.print()

        const printed = await confirmModal('Only certificates that actually printed are saved to the log.', {
            title: 'Did the certificate print?',
            confirmButtonText: 'Yes, save it',
            cancelButtonText: 'No, don’t save',
        })
        if (!printed) return

        try {
            setSaving(true)
            const { data: { user } } = await supabase.auth.getUser()

            const certificate = {
                student_name: form.studentName.trim(),
                program: form.program.trim(),
                year_level: form.yearLevel,
                semester: form.semester,
                school_year: form.schoolYear.trim(),
                purpose: `${purposeText} purposes only`,
                registrar_name: REGISTRAR_NAME,
                or_number: form.orNumber.trim() || null,
                cert_number: form.certNumber.trim() || null,
                encoder_initials: form.encoderInitials.trim() || null,
                issued_date: form.issuedDate,
                issued_by: user.id,
            }

            let { data: saved, error } = await supabase.from('enrollment_certificates').insert(certificate).select('certificate_id').single()

            if (error && /encoder_initials/.test(error.message || '')) {
                ;({ data: saved, error } = await supabase.from('enrollment_certificates').insert({ ...certificate, encoder_initials: undefined }).select('certificate_id').single())
            }

            if (error) throw error

            const sealError = await sealPrintedDocument({
                code: sealCode,
                docType: 'coe',
                title: 'Certificate of Enrollment',
                studentName: certificate.student_name,
                sourceId: saved?.certificate_id,
                content: {
                    program: certificate.program,
                    year_level: certificate.year_level,
                    semester: certificate.semester,
                    school_year: certificate.school_year,
                    purpose: certificate.purpose,
                    issued_date: certificate.issued_date,
                    or_number: certificate.or_number,
                    cert_number: certificate.cert_number,
                    registrar_name: certificate.registrar_name,
                },
            })
            setSealCode(newSealCode())

            loadMyCounts()
            if (sealError) {
                console.error('SEAL CERTIFICATE ERROR:', sealError)
                notifyWarning('Certificate logged, but its verification QR could not be registered.')
            } else {
                notifySuccess('Certificate logged and sealed for verification.')
            }
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

    const sheet = (
        <>
                <div className="coe-fixed">
                    {PLACED_IMAGES.map((img) => (
                        <img key={img.alt} src={img.src} alt={img.alt} className="coe-placed" style={placedStyle(img.box)} />
                    ))}

                    <p className="coe-lh coe-lh-name">{smallCaps('Holy Cross of Davao College, Inc.')}</p>
                    <p className="coe-lh coe-lh-office">OFFICE OF REGISTRATION AND RECORDS MANAGEMENT</p>
                    <p className="coe-lh coe-lh-1">Sta. Ana Avenue corner C. De Guzman Street, Brgy. 14-B, Davao City, Philippines</p>
                    <p className="coe-lh coe-lh-2">Tel. No. (082) 221 – 9071 to 79 loc. 116 &amp; 167 • Telefax: (082) 221-3008</p>
                    <p className="coe-lh coe-lh-3">Cellphone No.: (+63) 9468108617 &amp; (+63) 9061509582</p>
                    <p className="coe-lh coe-lh-4">
                        Email: <span className="coe-link">registrar@hcdc.edu.ph&nbsp;</span> • Website:{' '}
                        <span className="coe-link">http://www.hcdc.edu.ph/</span>
                    </p>
                    <div className="coe-rule coe-rule-top" aria-hidden="true" />

                    <div className="coe-rule coe-rule-bottom" aria-hidden="true" />
                    <span className="coe-footer-label" style={{ left: '53.5pt' }}>Accredited:</span>
                    <span className="coe-footer-label" style={{ left: '246.1pt' }}>Institutional Membership:</span>
                    <span className="coe-footer-label" style={{ left: '470.6pt' }}>Certified: ISO 21001:2018</span>
                    <SealQr code={sealCode} className="coe-seal-qr" />
                </div>

                <h2 className="coe-title">C E R T I F I C A T I O N</h2>

                <p className="coe-salutation">TO WHOM IT MAY CONCERN:</p>

                <p className="coe-body">
                    THIS IS TO CERTIFY that <Fill bold>{form.studentName.trim().toUpperCase() || '_______________'}</Fill>,{' '}
                    <Fill>{keepHyphens(yearAdjective)}</Fill> student in <Fill bold>{(form.program.trim() || '_______________').toUpperCase()}</Fill>{' '}
                    of HOLY CROSS OF DAVAO COLLEGE, INC., <Fill>is</Fill> officially enrolled{' '}
                    <Fill>this {form.semester}, <span className="coe-nowrap">S.Y. {form.schoolYear.trim() || '_______'}.</span></Fill>
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
