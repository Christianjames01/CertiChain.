import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { confirmModal, notifyError, notifySuccess } from '../../lib/notify'
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
import './TranscriptOfRecords.css'

const REGISTRAR_NAME = 'MRS. JENNIFER C. YEE'
const PAGE_WIDTH_PX = 816
const PRINT_PAGE_RULE = '@page { size: 8.5in 13in; margin: 0; }'

const FOOTER_SHIFT = 166
const HEADER_IMAGES = [
    { src: sealImg, alt: 'Holy Cross of Davao College seal', box: [45.0, 37.0, 78.0, 84.1] },
    { src: hcdc75Img, alt: 'HCDC 75 Years of Grace and Growth', box: [480.2, 32.2, 96.1, 96.1] },
]
const FOOTER_IMAGES = [
    { src: pacuImg, alt: 'PACU', box: [43.9, 720.2, 37.1, 36.0] },
    { src: pacucoaImg, alt: 'PACUCOA', box: [81.5, 719.9, 35.3, 36.0] },
    { src: aunQaImg, alt: 'ASEAN University Network / AUN-QA', box: [136.6, 719.5, 65.6, 35.4] },
    { src: erasmusImg, alt: 'Erasmus+', box: [196.8, 719.9, 109.6, 36.1] },
    { src: eccpImg, alt: 'European Chamber of Commerce of the Philippines', box: [304.8, 720.5, 50.4, 35.2] },
    { src: jccmiImg, alt: 'The Japanese Chamber of Commerce of Mindanao', box: [357.1, 720.1, 36.5, 36.0] },
    { src: ceapImg, alt: 'Catholic Educational Association of the Philippines', box: [395.8, 720.0, 36.0, 36.0] },
    { src: dacsImg, alt: 'Davao Association of Catholic Schools', box: [435.0, 720.2, 36.0, 36.0] },
    { src: tuvnordImg, alt: 'TÜV NORD', box: [503.8, 720.0, 63.6, 36.2] },
].map((img) => ({ ...img, box: [img.box[0], img.box[1] + FOOTER_SHIFT, img.box[2], img.box[3]] }))

const placedStyle = ([left, top, width, height]) => ({ left: `${left}pt`, top: `${top}pt`, width: `${width}pt`, height: `${height}pt` })

const smallCaps = (text) =>
    text.split(/([a-z]+)/).map((part, i) => (i % 2 ? <span key={i} className="otr-sc">{part.toUpperCase()}</span> : part))

const GRADING_SYSTEM = [
    '1.0 (100); 1.1 (99); 1.2 (98); 1.3 (97); 1.4 (96); 1.5 (95); 1.6 (94); 1.7 (93); 1.8 (92); 1.9 (91); 2.0 (90); 2.1 (89); 2.2 (88);',
    '2.3 (87); 2.4 (86); 2.5 (85); 2.6 (84); 2.7 (83); 2.8 (82); 2.9 (81) 3.0 (80);3.1(79);3.2(78);3.3(77);3.4(76);3.5(75)',
    '5.0 (Failed); 9.0 (Dropped); P - Passed (No Unit)',
]

const SCHOOL_HEADING = 'HOLY CROSS OF DAVAO COLLEGE  -  Davao City'
const CLOSED_LINE = 'hcdchcdchcdchcdchcdchcdchcdchcdchcdchcdchcdc*transcriptclosed*hcdchcdchcdchcdchcdchcdchcdchcdchcdchcdchcdc'

const ROW_PT = 11.75
const FIRST_PAGE_LINES = 38
const OTHER_PAGE_LINES = 56
const SIGN_LINES = 9

const TERM_ORDER = (term) => {
    const t = (term || '').toLowerCase()
    if (t.includes('summer')) return 3
    if (t.includes('2nd') || t.includes('second')) return 2
    if (t.includes('1st') || t.includes('first')) return 1
    return 4
}

const termHeading = (term, academicYear) => {
    const t = (term || '').toLowerCase()
    const label = t.includes('summer')
        ? 'SUMMER SESSION'
        : t.includes('2nd') || t.includes('second')
            ? 'SECOND SEMESTER'
            : t.includes('1st') || t.includes('first')
                ? 'FIRST SEMESTER'
                : (term || '').toUpperCase()
    const year = (academicYear || '').trim()
    if (!year) return label
    return t.includes('summer') ? `${label} - ${year.split('-').pop()}` : `${label} - ${year}`
}

const formatUnits = (units) => {
    if (units === null || units === undefined || units === '') return ''
    const n = Number(units)
    return Number.isFinite(n) ? n.toFixed(1) : String(units)
}

const formatLongDate = (iso) => {
    if (!iso) return ''
    const d = new Date(`${iso}T00:00:00`)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const formatShortDate = (iso) => {
    if (!iso) return ''
    const d = new Date(`${iso}T00:00:00`)
    return Number.isNaN(d.getTime()) ? iso : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

let rowSeq = 0
const newRow = (fields) => ({ id: `r${++rowSeq}`, kind: 'course', code: '', title: '', final: '', completion: '', units: '', ...fields })

const EMPTY_FORM = {
    name: '',
    sex: '',
    birthDate: '',
    birthPlace: '',
    citizenship: 'Filipino',
    acrNo: '',
    address: '',
    guardian: '',
    juniorHigh: '',
    juniorHighYear: '',
    seniorHigh: '',
    seniorHighYear: '',
    collegeOf: '',
    entranceData: '',
    studentNumber: '',
    otrNo: '',
    graduatedText: '',
    remarks: 'GRADUATED',
    preparedBy: '',
    preparedDate: new Date().toISOString().slice(0, 10),
    prePrinted: false,
}

const linesFor = (item) => {
    if (item.kind === 'graduated') return Math.ceil((Math.ceil((item.text || '').length / 100) * 13 + 2) / ROW_PT)
    if (item.kind === 'remarks') return 7
    return 1
}

const capOf = (pageIndex) => (pageIndex === 0 ? FIRST_PAGE_LINES : OTHER_PAGE_LINES)
const usedOf = (list) => list.reduce((sum, item) => sum + linesFor(item), 0)

function paginate(items) {
    const pages = [[]]
    let used = 0
    let lastTerm = ''
    for (const item of items) {
        const need = linesFor(item)
        if (used + need > capOf(pages.length - 1) && pages[pages.length - 1].length > 0) {
            pages.push([])
            used = 0
            if (item.kind === 'course' && lastTerm) {
                pages[pages.length - 1].push({ id: `cont-${item.id}`, kind: 'term', title: `${lastTerm} cont'n....` })
                used = 1
            }
        }
        if (item.kind === 'term') lastTerm = item.title
        pages[pages.length - 1].push(item)
        used += need
    }
    while (usedOf(pages[pages.length - 1]) + SIGN_LINES > capOf(pages.length - 1)) {
        const last = pages[pages.length - 1]
        const moved = []
        while (last.length > 1 && usedOf(last) + SIGN_LINES > capOf(pages.length - 1)) moved.unshift(last.pop())
        if (!moved.length) break
        pages.push(moved)
    }
    return pages
}

const BOLD_RE = new RegExp([
    "[A-Z][A-Z.,&'-]*(?![a-z])(?:\\s+[A-Z][A-Z.,&'-]*(?![a-z])){2,}",
    '\\bEXEMPTED\\b',
    '\\bSpecial Order\\b',
    'PAASCU Level [IVX]+ (?:Re-)?Accredited',
    '\\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\\.? \\d{1,2}, \\d{4}\\.?',
].map((p) => `(?:${p})`).join('|'), 'g')

const boldParts = (text) => {
    const out = []
    let last = 0
    for (const m of text.matchAll(BOLD_RE)) {
        if (m.index > last) out.push(text.slice(last, m.index))
        out.push(<strong key={m.index}>{m[0]}</strong>)
        last = m.index + m[0].length
    }
    if (last < text.length) out.push(text.slice(last))
    return out
}

const CLOSED_WIDTH_PT = 538

function TranscriptOfRecords() {
    const [students, setStudents] = useState([])
    const [studentQuery, setStudentQuery] = useState('')
    const [selectedStudentId, setSelectedStudentId] = useState('')
    const [loadingStudent, setLoadingStudent] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [rows, setRows] = useState([newRow({ kind: 'school', title: SCHOOL_HEADING })])
    const [subjects, setSubjects] = useState(null)
    const [previewScale, setPreviewScale] = useState(1)
    const [employeeId, setEmployeeId] = useState(null)
    const previewWrapRef = useRef(null)

    useEffect(() => {
        const wrap = previewWrapRef.current
        if (!wrap) return
        const observer = new ResizeObserver(([entry]) => {
            setPreviewScale(Math.min(1, entry.contentRect.width / PAGE_WIDTH_PX))
        })
        observer.observe(wrap)
        return () => observer.disconnect()
    }, [])

    const loadMe = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const [{ data: profile }, { data: employee }] = await Promise.all([
            supabase.from('profiles').select('first_name, middle_name, last_name').eq('user_id', user.id).maybeSingle(),
            supabase.from('employees').select('employee_id').eq('user_id', user.id).maybeSingle(),
        ])
        setEmployeeId(employee?.employee_id || null)
        if (profile) {
            const middle = profile.middle_name ? ` ${profile.middle_name.trim()[0]}.` : ''
            setForm((f) => ({ ...f, preparedBy: f.preparedBy || `${profile.first_name}${middle} ${profile.last_name}`.trim() }))
        }
    }

    const loadStudents = async () => {
        const { data: rowsData } = await supabase
            .from('students')
            .select('student_id, user_id, student_number')
            .order('student_number')
        const list = rowsData || []
        const userIds = [...new Set(list.map((s) => s.user_id).filter(Boolean))]
        const { data: profiles } = userIds.length
            ? await supabase.from('profiles').select('user_id, first_name, middle_name, last_name, suffix').in('user_id', userIds)
            : { data: [] }
        const byUser = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
        setStudents(list.map((s) => {
            const p = byUser[s.user_id]
            return { ...s, label: p ? `${p.last_name}, ${p.first_name} — ${s.student_number || 'no ID'}` : `${s.student_number || 'Student'}` }
        }))
    }

    useEffect(() => {
        loadStudents()
        loadMe()
        import('./otrSubjects.json').then((m) => setSubjects(m.default || m))
    }, [])

    const subjectByCode = useMemo(() => {
        if (!subjects) return {}
        return Object.fromEntries(subjects.map(([code, title, units]) => [code.toLowerCase(), { code, title, units }]))
    }, [subjects])

    const pickStudent = async (studentId) => {
        setSelectedStudentId(studentId)
        if (!studentId) return
        try {
            setLoadingStudent(true)
            const { data: student, error } = await supabase
                .from('students')
                .select('student_id, user_id, student_number, program_id, birth_date, address')
                .eq('student_id', studentId)
                .single()
            if (error || !student) throw error || new Error('Student not found.')

            const [{ data: profile }, { data: program }, { data: grades }] = await Promise.all([
                supabase.from('profiles').select('first_name, middle_name, last_name, suffix').eq('user_id', student.user_id).maybeSingle(),
                student.program_id
                    ? supabase.from('programs').select('program_name').eq('program_id', student.program_id).maybeSingle()
                    : Promise.resolve({ data: null }),
                supabase.from('student_grades').select('curriculum_course_id, academic_year, grade').eq('student_id', studentId),
            ])

            const courseIds = [...new Set((grades || []).map((g) => g.curriculum_course_id))]
            const { data: courses } = courseIds.length
                ? await supabase.from('curriculum_courses').select('curriculum_course_id, course_code, course_name, units, term, display_order').in('curriculum_course_id', courseIds)
                : { data: [] }
            const courseById = Object.fromEntries((courses || []).map((c) => [c.curriculum_course_id, c]))

            const graded = (grades || [])
                .map((g) => ({ ...g, course: courseById[g.curriculum_course_id] }))
                .filter((g) => g.course)
                .sort((a, b) =>
                    (a.academic_year || '').localeCompare(b.academic_year || '') ||
                    TERM_ORDER(a.course.term) - TERM_ORDER(b.course.term) ||
                    (a.course.display_order || 0) - (b.course.display_order || 0))

            const nextRows = [newRow({ kind: 'school', title: SCHOOL_HEADING })]
            let lastHeading = ''
            for (const g of graded) {
                const heading = termHeading(g.course.term, g.academic_year)
                if (heading !== lastHeading) {
                    nextRows.push(newRow({ kind: 'term', title: heading }))
                    lastHeading = heading
                }
                nextRows.push(newRow({
                    code: g.course.course_code,
                    title: g.course.course_name,
                    final: g.grade || '',
                    units: formatUnits(g.course.units),
                }))
            }
            setRows(nextRows)

            const middleInitial = profile?.middle_name ? ` ${profile.middle_name.trim()[0]}.` : ''
            const name = profile
                ? `${profile.last_name}, ${profile.first_name}${middleInitial}${profile.suffix ? ` ${profile.suffix}` : ''}`.toUpperCase()
                : ''
            const programName = (program?.program_name || '').toUpperCase()

            setForm((f) => ({
                ...f,
                name,
                studentNumber: student.student_number || '',
                birthDate: student.birth_date || '',
                address: student.address || '',
                collegeOf: programName,
                graduatedText: programName
                    ? `Graduated from HOLY CROSS OF DAVAO COLLEGE, INC., Davao City with the degree of ${programName} on ____________.`
                    : f.graduatedText,
            }))

            if (graded.length === 0) {
                notifyError('This student has no grades recorded in the system yet. Add the courses below by hand.', 'No grades on file')
            }
        } catch (err) {
            console.error('OTR LOAD STUDENT ERROR:', err)
            notifyError('Could not load this student. Please try again.')
        } finally {
            setLoadingStudent(false)
        }
    }

    const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
    const updateRow = (id, key, value) => setRows((list) => list.map((r) => (r.id === id ? { ...r, [key]: value } : r)))
    const removeRow = (id) => setRows((list) => list.filter((r) => r.id !== id))
    const addRow = (kind) => setRows((list) => [...list, newRow(kind === 'term' ? { kind: 'term', title: '' } : {})])
    const moveRow = (id, dir) => setRows((list) => {
        const i = list.findIndex((r) => r.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= list.length) return list
        const next = [...list]
        ;[next[i], next[j]] = [next[j], next[i]]
        return next
    })

    const fillFromCode = (row) => {
        const hit = subjectByCode[(row.code || '').trim().toLowerCase().replace(/\s+/g, ' ')]
        if (!hit) return
        setRows((list) => list.map((r) => (r.id === row.id
            ? { ...r, code: hit.code, title: r.title || hit.title, units: r.units || formatUnits(hit.units) }
            : r)))
    }

    const items = [
        ...rows,
        { id: 'closed', kind: 'closed' },
        ...(form.graduatedText.trim() ? [{ id: 'graduated', kind: 'graduated', text: form.graduatedText.trim() }] : []),
        { id: 'remarks', kind: 'remarks', text: form.remarks.trim() },
    ]
    const pages = paginate(items)
    const pageCount = pages.length

    const canPrint = form.name.trim() && rows.some((r) => r.kind === 'course' && (r.code || r.title))

    const print = async () => {
        if (!canPrint) {
            notifyError('Pick a student (or type the name) and add at least one course first.')
            return
        }
        window.print()
        const printed = await confirmModal('Only transcripts that actually printed are recorded in the activity log.', {
            title: 'Did the transcript print?',
            confirmButtonText: 'Yes, record it',
            cancelButtonText: 'No',
        })
        if (!printed) return
        await logActivity({
            employeeId,
            action: 'generate_transcript',
            tableName: 'students',
            recordId: selectedStudentId || null,
            description: `Printed the Transcript of Records for ${form.name.trim()} (${form.studentNumber.trim() || 'no student ID'})${form.otrNo.trim() ? `, OTR No. ${form.otrNo.trim()}` : ''}.`,
        })
        notifySuccess('Transcript recorded in your activity log.')
    }

    const renderRow = (item) => {
        if (item.kind === 'school') {
            return (
                <tr key={item.id} className="otr-row-heading">
                    <td colSpan={2}><span className="otr-school">{item.title}</span></td>
                    <td /><td /><td />
                </tr>
            )
        }
        if (item.kind === 'term') {
            return (
                <tr key={item.id} className="otr-row-heading">
                    <td colSpan={2}><span className="otr-term">{item.title}</span></td>
                    <td /><td /><td />
                </tr>
            )
        }
        if (item.kind === 'closed') {
            return (
                <tr key={item.id} className="otr-row-closed">
                    <td colSpan={5}>
                        <svg className="otr-closed-svg" width={`${CLOSED_WIDTH_PT}pt`} height="12pt" viewBox={`0 0 ${CLOSED_WIDTH_PT} 12`} aria-label={CLOSED_LINE}>
                            <text x="0" y="9.6" textLength={CLOSED_WIDTH_PT} lengthAdjust="spacingAndGlyphs">{CLOSED_LINE}</text>
                        </svg>
                    </td>
                </tr>
            )
        }
        if (item.kind === 'graduated') {
            return (
                <tr key={item.id} className="otr-row-text">
                    <td colSpan={5}>{boldParts(item.text)}</td>
                </tr>
            )
        }
        if (item.kind === 'remarks') {
            return (
                <tr key={item.id} className="otr-row-remarks">
                    <td />
                    <td><span className="otr-remarks-label">REMARKS:</span>&nbsp;&nbsp;&nbsp; <strong>{item.text}</strong>{item.text && <strong> ........</strong>}</td>
                    <td /><td /><td />
                </tr>
            )
        }
        return (
            <tr key={item.id}>
                <td>{item.code}</td>
                <td className="otr-title-cell">{item.title}</td>
                <td className="otr-num">{item.final}</td>
                <td className="otr-num">{item.completion}</td>
                <td className="otr-num">{item.units}</td>
            </tr>
        )
    }

    const infoLine = (cells, className = 'otr-hinfo-line') => (
        <div className={className}>
            {cells.map(([left, text, cls], i) => (
                <span key={i} className={cls} style={{ left: `${left}pt` }}>{text}</span>
            ))}
        </div>
    )

    const courseTable = (pageItems, isFirst) => (
        <table className={`otr-table${isFirst ? ' is-first' : ''}`}>
            <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '61%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '6.5%' }} />
                <col style={{ width: '7.5%' }} />
            </colgroup>
            <thead>
                {isFirst ? (
                    <>
                        <tr>
                            <td colSpan={2} className="otr-hinfo">
                                {infoLine([[2, 'College of:', 'otr-k'], [84, form.collegeOf, 'otr-strong']])}
                            </td>
                            <th colSpan={2}>GRADE</th>
                            <th rowSpan={3}>UNITS</th>
                        </tr>
                        <tr>
                            <td colSpan={2} className="otr-hinfo">
                                {infoLine([[2, 'Entrance Data:', 'otr-k'], [94, form.entranceData], [200, 'Student I.D. No.:', 'otr-k'], [292, form.studentNumber]])}
                            </td>
                            <th rowSpan={2}>FINAL</th>
                            <th rowSpan={2} className="otr-th-small">Com-<br />pletion</th>
                        </tr>
                        <tr>
                            <th>Term &amp; Course<br />No.</th>
                            <th className="otr-th-title">D E S C R I P T I V E &nbsp; T I T L E</th>
                        </tr>
                    </>
                ) : (
                    <>
                        <tr>
                            <th rowSpan={2}>Term &amp; Course<br />No.</th>
                            <th rowSpan={2} className="otr-th-title">D E S C R I P T I V E &nbsp; T I T L E</th>
                            <th colSpan={2}>GRADE</th>
                            <th rowSpan={2}>UNITS</th>
                        </tr>
                        <tr>
                            <th>FINAL</th>
                            <th className="otr-th-small">Com-<br />pletion</th>
                        </tr>
                    </>
                )}
            </thead>
            <tbody>
                {pageItems.map(renderRow)}
                {!pageItems.some((item) => item.kind === 'remarks') && <tr className="otr-filler"><td /><td /><td /><td /><td /></tr>}
            </tbody>
        </table>
    )

    const gradingBlock = (
        <div className="otr-grading">
            <strong>GRADING SYSTEM:</strong>
            {GRADING_SYSTEM.map((line) => <span key={line}>{line}</span>)}
        </div>
    )

    const sheet = (
        <>
            {pages.map((pageItems, index) => {
                const isFirst = index === 0
                const isLast = index === pageCount - 1
                return (
                    <div className={`otr-page${isFirst ? ' is-first' : ''}`} key={index}>
                        {isFirst && !form.prePrinted && (
                            <div className="otr-fixed">
                                {HEADER_IMAGES.map((img) => (
                                    <img key={img.alt} src={img.src} alt={img.alt} className="otr-placed" style={placedStyle(img.box)} />
                                ))}
                                <p className="otr-lh otr-lh-name">{smallCaps('Holy Cross of Davao College, Inc.')}</p>
                                <p className="otr-lh otr-lh-office">OFFICE OF REGISTRATION AND RECORDS MANAGEMENT</p>
                                <p className="otr-lh otr-lh-1">Sta. Ana Avenue corner C. De Guzman Street, Brgy. 14-B, Davao City, Philippines</p>
                                <p className="otr-lh otr-lh-2">Tel. No. (082) 221 – 9071 to 79 loc. 116 &amp; 167 • Telefax: (082) 221-3008</p>
                                <p className="otr-lh otr-lh-3">Cellphone No.: (+63) 9468108617 &amp; (+63) 9061509582</p>
                                <p className="otr-lh otr-lh-4">
                                    Email: <span className="otr-link">registrar@hcdc.edu.ph&nbsp;</span> • Website:{' '}
                                    <span className="otr-link">http://www.hcdc.edu.ph/</span>
                                </p>
                                <p className="otr-title">OFFICIAL TRANSCRIPT OF RECORDS</p>
                                <img src={sealImg} alt="" aria-hidden="true" className="otr-watermark" />

                                {FOOTER_IMAGES.map((img) => (
                                    <img key={img.alt} src={img.src} alt={img.alt} className="otr-placed" style={placedStyle(img.box)} />
                                ))}
                                <span className="otr-footer-label" style={{ left: '53.5pt' }}>Accredited:</span>
                                <span className="otr-footer-label" style={{ left: '246.1pt' }}>Institutional Membership:</span>
                                <span className="otr-footer-label" style={{ left: '470.6pt' }}>Certified: ISO 21001:2018</span>
                            </div>
                        )}

                        <div className="otr-body">
                            {isFirst ? (
                                <div className="otr-info">
                                    {infoLine([[2, 'Name:', 'otr-k'], [44, form.name, 'otr-strong'], [310, 'Sex:', 'otr-k'], [374, form.sex]], 'otr-info-row')}
                                    {infoLine([[2, 'Date of Birth:', 'otr-k'], [82, formatLongDate(form.birthDate)], [197, 'Place of Birth:', 'otr-k'], [322, form.birthPlace]], 'otr-info-row')}
                                    {infoLine([[2, 'Citizenship:', 'otr-k'], [82, form.citizenship], [305, 'ACR No. (If Alien)', 'otr-k'], [400, form.acrNo]], 'otr-info-row')}
                                    {infoLine([[2, 'Address:', 'otr-k'], [104, form.address]], 'otr-info-row')}
                                    {infoLine([[2, 'Parent/Guardian:', 'otr-k'], [104, form.guardian]], 'otr-info-row')}
                                    {infoLine([[2, 'Junior High School Completed at:', 'otr-k'], [232, form.juniorHigh], [430, form.juniorHighYear]], 'otr-info-row')}
                                    {infoLine([[2, 'Senior High School Completed at:', 'otr-k'], [232, form.seniorHigh], [430, form.seniorHighYear]], 'otr-info-row')}
                                </div>
                            ) : (
                                <p className="otr-name-top">{form.name}</p>
                            )}

                            {courseTable(pageItems, isFirst)}

                            {gradingBlock}
                            <p className="otr-page-no"><span>Page {index + 1} of {pageCount}</span></p>
                            <div className="otr-rule" />

                            {isFirst && (
                                <>
                                    <p className="otr-medium">ENGLISH IS THE MEDIUM OF INSTRUCTION</p>
                                    {pageCount > 1 && <p className="otr-refer">REMARKS: &nbsp;(Pls. refer back page for more entries)</p>}
                                    <p className="otr-otrno">OTR No.: <span>{form.otrNo}</span></p>
                                </>
                            )}

                            {isLast && (
                                <div className="otr-sign">
                                    <p className="otr-seal-note">not valid without school seal</p>
                                    <p className="otr-prepared" style={{ top: '42pt' }}><span>Prepared by:</span> {form.preparedBy}</p>
                                    <p className="otr-prepared" style={{ top: '56pt' }}><span>Date:&nbsp;&nbsp;:</span> {formatShortDate(form.preparedDate)}</p>
                                    <div className="otr-registrar">
                                        <strong>{REGISTRAR_NAME}</strong>
                                        <span>REGISTRAR</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </>
    )

    const filteredStudents = studentQuery.trim()
        ? students.filter((s) => s.label.toLowerCase().includes(studentQuery.trim().toLowerCase())).slice(0, 50)
        : students.slice(0, 50)

    return (
        <div>
            <style>{PRINT_PAGE_RULE}</style>

            <header className="employee-page-header">
                <h1>Transcript of Records</h1>
                <p>Pick a student to fill in their details and grades, add anything else, then print in the Registrar's Official Transcript of Records format.</p>
            </header>

            <div className="otr-layout">
                <section className="employee-card otr-form">
                    <h2 style={{ fontSize: 16, marginBottom: 4 }}>Student</h2>

                    <label className="otr-label" htmlFor="otr-find">Find a student</label>
                    <input
                        id="otr-find"
                        className="employee-search-input"
                        placeholder="Type a name or student number"
                        value={studentQuery}
                        onChange={(e) => setStudentQuery(e.target.value)}
                    />
                    <select
                        className="employee-search-input"
                        style={{ marginTop: 8 }}
                        value={selectedStudentId}
                        onChange={(e) => pickStudent(e.target.value)}
                        aria-label="Select student"
                    >
                        <option value="">{students.length ? '-- Select student --' : 'Loading students...'}</option>
                        {filteredStudents.map((s) => <option key={s.student_id} value={s.student_id}>{s.label}</option>)}
                    </select>
                    {loadingStudent && <span className="otr-hint">Loading the student's record and grades…</span>}

                    <h2 style={{ fontSize: 16, margin: '20px 0 4px' }}>Details</h2>
                    <div className="otr-grid">
                        <label className="otr-field otr-span-2"><span>Name (LAST, FIRST M.)</span><input className="employee-search-input" value={form.name} onChange={update('name')} /></label>
                        <label className="otr-field"><span>Sex</span>
                            <select className="employee-search-input" value={form.sex} onChange={update('sex')}>
                                <option value="">--</option><option>Female</option><option>Male</option>
                            </select>
                        </label>
                        <label className="otr-field"><span>Student I.D. No.</span><input className="employee-search-input" value={form.studentNumber} onChange={update('studentNumber')} /></label>
                        <label className="otr-field"><span>Date of Birth</span><input type="date" className="employee-search-input" value={form.birthDate} onChange={update('birthDate')} /></label>
                        <label className="otr-field"><span>Place of Birth</span><input className="employee-search-input" value={form.birthPlace} onChange={update('birthPlace')} /></label>
                        <label className="otr-field"><span>Citizenship</span><input className="employee-search-input" value={form.citizenship} onChange={update('citizenship')} /></label>
                        <label className="otr-field"><span>ACR No. (if alien)</span><input className="employee-search-input" value={form.acrNo} onChange={update('acrNo')} /></label>
                        <label className="otr-field otr-span-2"><span>Address</span><input className="employee-search-input" value={form.address} onChange={update('address')} /></label>
                        <label className="otr-field otr-span-2"><span>Parent / Guardian</span><input className="employee-search-input" value={form.guardian} onChange={update('guardian')} /></label>
                        <label className="otr-field"><span>Junior High School</span><input className="employee-search-input" value={form.juniorHigh} onChange={update('juniorHigh')} /></label>
                        <label className="otr-field"><span>Year (e.g. 2019-2020)</span><input className="employee-search-input" value={form.juniorHighYear} onChange={update('juniorHighYear')} /></label>
                        <label className="otr-field"><span>Senior High School</span><input className="employee-search-input" value={form.seniorHigh} onChange={update('seniorHigh')} /></label>
                        <label className="otr-field"><span>Year (e.g. 2021-2022)</span><input className="employee-search-input" value={form.seniorHighYear} onChange={update('seniorHighYear')} /></label>
                        <label className="otr-field otr-span-2"><span>College of (program)</span><input className="employee-search-input" value={form.collegeOf} onChange={update('collegeOf')} /></label>
                        <label className="otr-field"><span>Entrance Data</span><input className="employee-search-input" placeholder="e.g. F138/PIC/PSA" value={form.entranceData} onChange={update('entranceData')} /></label>
                        <label className="otr-field"><span>OTR No.</span><input className="employee-search-input" value={form.otrNo} onChange={update('otrNo')} /></label>
                    </div>

                    <h2 style={{ fontSize: 16, margin: '20px 0 4px' }}>Courses</h2>
                    <p className="otr-hint">Type a course code and leave the box to fill in its title and units.</p>
                    <div className="otr-rows">
                        {rows.map((r) => (
                            <div className={`otr-edit-row is-${r.kind}`} key={r.id}>
                                {r.kind === 'course' ? (
                                    <>
                                        <input className="employee-search-input" placeholder="Code" value={r.code} onChange={(e) => updateRow(r.id, 'code', e.target.value)} onBlur={() => fillFromCode(r)} />
                                        <input className="employee-search-input" placeholder="Descriptive title" value={r.title} onChange={(e) => updateRow(r.id, 'title', e.target.value)} />
                                        <input className="employee-search-input" placeholder="Final" value={r.final} onChange={(e) => updateRow(r.id, 'final', e.target.value)} />
                                        <input className="employee-search-input" placeholder="Compl." value={r.completion} onChange={(e) => updateRow(r.id, 'completion', e.target.value)} />
                                        <input className="employee-search-input" placeholder="Units" value={r.units} onChange={(e) => updateRow(r.id, 'units', e.target.value)} />
                                    </>
                                ) : (
                                    <input
                                        className="employee-search-input otr-heading-input"
                                        placeholder="e.g. FIRST SEMESTER - 2022-2023"
                                        value={r.title}
                                        onChange={(e) => updateRow(r.id, 'title', e.target.value)}
                                    />
                                )}
                                <div className="otr-row-actions">
                                    <button type="button" onClick={() => moveRow(r.id, -1)} aria-label="Move up">↑</button>
                                    <button type="button" onClick={() => moveRow(r.id, 1)} aria-label="Move down">↓</button>
                                    <button type="button" onClick={() => removeRow(r.id)} aria-label="Remove row">✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        <button type="button" className="employee-secondary-button" onClick={() => addRow('term')}>+ Term heading</button>
                        <button type="button" className="employee-secondary-button" onClick={() => addRow('course')}>+ Course</button>
                    </div>

                    <h2 style={{ fontSize: 16, margin: '20px 0 4px' }}>Closing</h2>
                    <label className="otr-field"><span>Graduation / completion text</span>
                        <textarea className="employee-search-input" rows={4} value={form.graduatedText} onChange={update('graduatedText')} />
                    </label>
                    <div className="otr-grid">
                        <label className="otr-field"><span>Remarks</span><input className="employee-search-input" value={form.remarks} onChange={update('remarks')} /></label>
                        <label className="otr-field"><span>Prepared by</span><input className="employee-search-input" value={form.preparedBy} onChange={update('preparedBy')} /></label>
                        <label className="otr-field"><span>Date prepared</span><input type="date" className="employee-search-input" value={form.preparedDate} onChange={update('preparedDate')} /></label>
                    </div>
                    <label className="otr-check">
                        <input type="checkbox" checked={form.prePrinted} onChange={update('prePrinted')} />
                        Printing on pre-printed transcript paper (leave out the letterhead and logos)
                    </label>

                    <button className="employee-primary-button" style={{ marginTop: 20 }} onClick={print} disabled={!canPrint}>
                        Print Transcript ({pageCount} page{pageCount === 1 ? '' : 's'})
                    </button>
                </section>

                <section className="otr-preview-wrap" ref={previewWrapRef}>
                    <div className="otr-preview" style={{ zoom: previewScale }}>
                        {sheet}
                    </div>
                </section>
            </div>

            {createPortal(
                <div className="otr-print-root">
                    <div className="otr-preview">{sheet}</div>
                </div>,
                document.body,
            )}
        </div>
    )
}

export default TranscriptOfRecords
