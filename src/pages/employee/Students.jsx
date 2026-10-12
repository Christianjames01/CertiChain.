import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId, notifyError, notifySuccess, confirmModal } from '../../lib/notify'
import { deleteStudentAccount } from '../../lib/deleteStudentAccount'
import { confirmWithPassword } from '../../lib/confirmPassword'
import Swal from 'sweetalert2'
import { SkeletonTable } from '../../components/Skeleton'
import PageStats from '../../components/PageStats'
import { IconIdCard, IconHourglass, IconLayers, IconBuilding } from '../admin/icons'
import './EmployeePages.css'
import AvatarFace from '../../components/AvatarFace'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { friendlyError } from '../../lib/friendlyError'

// Pending registrations are reviewed in their own section and rejected ones
// aren't real students, so only verified (or pre-verification) students
// appear in the student list and search results.
function onlyListedStudents(rows) {
    return rows.filter((s) => s.verification_status !== 'pending' && s.verification_status !== 'rejected')
}

function Students() {
    const navigate = useNavigate()

    const [term, setTerm] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [pendingVerifications, setPendingVerifications] = useState([])
    const [incompleteProfiles, setIncompleteProfiles] = useState([])
    const [deletingProfileId, setDeletingProfileId] = useState(null)
    const [reviewingId, setReviewingId] = useState(null)
    const [selectedProgramKey, setSelectedProgramKey] = useState(null)
    const [yearLevelFilter, setYearLevelFilter] = useState('all')

    useLiveRefresh(['students'], () => { loadPendingVerifications(); loadAllStudents({ silent: true }) })

    useEffect(() => {
        loadAllStudents()
        loadPendingVerifications()
    }, [])

    const loadPendingVerifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: employee } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('user_id', user.id)
                .maybeSingle()

            if (!employee) return

            const { data: assignments } = await supabase
                .from('employee_assignments')
                .select('college_id, program_id')
                .eq('employee_id', employee.employee_id)
                .eq('status', 'active')

            const assignedPairs = new Set((assignments || []).map((a) => `${a.college_id}:${a.program_id}`))
            if (assignedPairs.size === 0) return

            const { data: pending } = await supabase
                .from('students')
                .select('*')
                .eq('verification_status', 'pending')
                .order('created_at', { ascending: true })

            const mine = (pending || []).filter((s) => assignedPairs.has(`${s.college_id}:${s.program_id}`))

            setPendingVerifications(await enrichStudents(mine))

        } catch (err) {
            console.error('LOAD PENDING VERIFICATIONS ERROR:', err)
        }
    }

    const approveStudent = async (student) => {
        const confirmed = await confirmModal(
            `Approve ${student.fullName}'s registration? They will be able to log in and submit requests.`,
            { title: 'Approve registration?', confirmButtonText: 'Approve', icon: 'question' }
        )
        if (!confirmed) return

        await reviewStudent(student, 'approved')
    }

    const rejectStudent = async (student) => {
        const { value: reason } = await Swal.fire({
            title: 'Reject registration',
            allowOutsideClick: false,
            input: 'text',
            inputLabel: 'Reason (shown to the student)',
            inputPlaceholder: 'e.g. Student number not found in enrollment records',
            showCancelButton: true,
            confirmButtonText: 'Reject',
            confirmButtonColor: '#dc3545',
        })

        if (!reason) return

        const verified = await confirmWithPassword({
            title: 'Confirm with your password',
            text: `Enter your password to reject ${student.fullName}'s registration.`,
        })
        if (!verified) return

        await reviewStudent(student, 'rejected', reason)
    }

    const reviewStudent = async (student, decision, reason) => {
        try {
            setReviewingId(student.student_id)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('You are not logged in.')

            const { data: employee } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('user_id', user.id)
                .maybeSingle()

            const { error: updateError } = await supabase
                .from('students')
                .update({
                    verification_status: decision,
                    verification_note: reason || null,
                    verified_by: user.id,
                    verified_at: new Date().toISOString(),
                })
                .eq('student_id', student.student_id)

            if (updateError) throw new Error(updateError.message)

            await notifyStudentByStudentId({
                studentId: student.student_id,
                title: decision === 'approved' ? 'Account verified' : 'Registration not verified',
                message: decision === 'approved'
                    ? "Your enrollment has been verified. You can now log in and use CertiChain."
                    : `Your registration could not be verified: ${reason}. Contact the Registrar's Office for help.`,
            })

            await logActivity({
                employeeId: employee?.employee_id,
                userId: employee ? null : user.id,
                action: decision === 'approved' ? 'approve_student_registration' : 'reject_student_registration',
                tableName: 'students',
                recordId: student.student_id,
                description: `${decision === 'approved' ? 'Approved' : 'Rejected'} registration for "${student.fullName}" (${student.student_number}).`,
            })

            setPendingVerifications((prev) => prev.filter((s) => s.student_id !== student.student_id))
            if (decision === 'rejected') {
                setResults((prev) => prev.filter((s) => s.student_id !== student.student_id))
            }

        } catch (err) {
            console.error('REVIEW STUDENT ERROR:', err)
            notifyError(friendlyError(err, 'Failed to review student.'))
        } finally {
            setReviewingId(null)
        }
    }

    const enrichStudents = async (rows) => {
        const userIds = [...new Set(rows.map((s) => s.user_id))]

        const { data: profiles } = userIds.length
            ? await supabase.from('profiles').select('user_id, first_name, last_name, email, profile_photo_url').in('user_id', userIds)
            : { data: [] }

        const profileByUserId = Object.fromEntries(
            (profiles || []).map((p) => [p.user_id, p])
        )

        const collegeIds = [...new Set(rows.map((s) => s.college_id).filter(Boolean))]
        const programIds = [...new Set(rows.map((s) => s.program_id).filter(Boolean))]

        const [{ data: colleges }, { data: programs }] = await Promise.all([
            collegeIds.length
                ? supabase.from('colleges').select('college_id, college_name').in('college_id', collegeIds)
                : Promise.resolve({ data: [] }),
            programIds.length
                ? supabase.from('programs').select('program_id, program_name').in('program_id', programIds)
                : Promise.resolve({ data: [] }),
        ])

        const collegeNameById = Object.fromEntries((colleges || []).map((c) => [c.college_id, c.college_name]))
        const programNameById = Object.fromEntries((programs || []).map((p) => [p.program_id, p.program_name]))

        return rows.map((s) => {
            const profile = profileByUserId[s.user_id]

            return {
                ...s,
                fullName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown',
                email: profile?.email || '',
                photoUrl: profile?.profile_photo_url || '',
                collegeName: collegeNameById[s.college_id] || '',
                programName: programNameById[s.program_id] || '',
            }
        })
    }

    const loadAllStudents = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data: rows, error: studentsError } = await supabase
                .from('students')
                .select('*')
                .order('student_number', { ascending: true })

            if (studentsError) {
                throw new Error('Failed to load students: ' + studentsError.message)
            }

            setResults(await enrichStudents(onlyListedStudents(rows || [])))
            await loadIncompleteProfiles(rows || [])

        } catch (err) {
            console.error('LOAD STUDENTS ERROR:', err)
            setError(err.message || 'Failed to load students.')
        } finally {
            setLoading(false)
        }
    }

    // Accounts that signed in but never finished "Complete your profile":
    // they have no student record yet, so they can't request anything.
    // Every student row (any verification status) counts as finished.
    const loadIncompleteProfiles = async (studentRows) => {
        const { data: studentProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, first_name, middle_name, last_name, suffix, email, phone_number, created_at, status, profile_photo_url')
            .eq('role', 'student')
            .order('created_at', { ascending: false })

        if (profilesError) {
            console.error('LOAD INCOMPLETE PROFILES ERROR:', profilesError)
            return
        }

        const studentUserIds = new Set(studentRows.map((s) => s.user_id))
        setIncompleteProfiles((studentProfiles || []).filter((p) => !studentUserIds.has(p.user_id)))
    }

    const incompleteName = (p) => `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Unknown'
    const incompleteFullName = (p) =>
        [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(' ') || p.email || 'Unknown'

    // An incomplete account has no student record, requests or files, so
    // deleting it only removes the login and profile. Confirmed with the
    // employee's own password, like the head's delete.
    const deleteIncompleteProfile = async (profile) => {
        const name = incompleteName(profile)

        try {
            setDeletingProfileId(profile.user_id)

            const confirmed = await confirmModal(
                `Permanently delete ${name}'s account? They never finished their registration, so there are no requests or files -- this removes their login and profile. This cannot be undone.`,
                { title: 'Delete this account?', confirmButtonText: 'Delete account', icon: 'warning' }
            )
            if (!confirmed) return

            const passwordConfirmed = await confirmWithPassword({
                title: 'Confirm your password',
                text: 'For your security, enter your own password to permanently delete this account.',
            })
            if (!passwordConfirmed) return

            await deleteStudentAccount({ studentUserId: profile.user_id })

            setIncompleteProfiles((prev) => prev.filter((p) => p.user_id !== profile.user_id))
            notifySuccess(`${name}'s account has been permanently deleted.`)
        } catch (err) {
            console.error('DELETE INCOMPLETE PROFILE ERROR:', err)
            notifyError(friendlyError(err, 'Failed to delete this account.'))
        } finally {
            setDeletingProfileId(null)
        }
    }

    // Live search while typing: every word must appear in the student's
    // name or student number.
    const searchWords = term.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const yearFilteredStudents = yearLevelFilter === 'all'
        ? results
        : yearLevelFilter === 'alumni'
            ? results.filter((st) => st.student_type === 'alumni')
            : results.filter((st) => st.student_type !== 'alumni' && String(st.year_level) === yearLevelFilter)

    const matches = searchWords.length
        ? yearFilteredStudents.filter((student) => {
            const haystack = `${student.fullName} ${student.student_number || ''}`.toLowerCase()
            return searchWords.every((word) => haystack.includes(word))
        })
        : []
    const incompleteMatches = searchWords.length
        ? incompleteProfiles.filter((p) => {
            const haystack = `${incompleteName(p)} ${p.email || ''}`.toLowerCase()
            return searchWords.every((word) => haystack.includes(word))
        })
        : []

    const groupedResults = (() => {
        const groups = {}

        for (const student of yearFilteredStudents) {
            const key = student.program_id || 'unassigned'

            if (!groups[key]) {
                groups[key] = {
                    key,
                    programName: student.programName || 'No Program Assigned',
                    collegeName: student.collegeName || 'Unassigned',
                    students: [],
                }
            }

            groups[key].students.push(student)
        }

        return Object.values(groups).sort((a, b) =>
            a.collegeName.localeCompare(b.collegeName) || a.programName.localeCompare(b.programName)
        )
    })()

    const selectedGroup = selectedProgramKey
        ? groupedResults.find((g) => g.key === selectedProgramKey)
        : null


    const renderStudentCard = (student) => (
        <div className="employee-list-card" key={student.student_id}>
            <div className="employee-list-card-header">
                <div className="ui-card-title" style={{ alignItems: 'center' }}>
                    <span className={`ui-avatar${student.status === 'active' ? '' : ' is-muted'}`} aria-hidden="true"><AvatarFace photo={student.photoUrl} name={student.fullName} /></span>
                    <div>
                        <h3>{student.fullName}</h3>
                        <p>{student.student_number} · {student.email}</p>
                    </div>
                </div>

                <span className={`employee-status-pill status-${student.status}`}>{student.status}</span>
            </div>

            <div className="employee-info-grid">
                <div className="employee-info-field">
                    <span>College</span>
                    <strong>{student.collegeName || 'N/A'}</strong>
                </div>

                <div className="employee-info-field">
                    <span>Program</span>
                    <strong>{student.programName || 'N/A'}</strong>
                </div>

                <div className="employee-info-field">
                    <span>{student.student_type === 'alumni' ? 'Alumni' : 'Year Level'}</span>
                    <strong>{student.student_type === 'alumni' ? `Class of ${student.graduation_year || '—'}` : student.year_level || 'N/A'}</strong>
                </div>
            </div>

            <div className="ui-card-actions">
                <button
                    className="employee-link-button"
                    onClick={() => navigate(`/employee/students/${student.student_id}`)}
                >
                    View request history →
                </button>
            </div>
        </div>
    )

    return (
        <div>
            <div className="employee-page-header">
                <h1>Students</h1>
                <p>All enrolled students. Search to narrow the list, or view a student's information and request history.</p>
            </div>

            {(
                <PageStats
                    loading={loading}
                    stats={[
                        { label: 'Students', value: results.length, note: 'Registered and verified', Icon: IconIdCard },
                        { label: 'Pending verification', value: pendingVerifications.length, note: pendingVerifications.length ? 'Waiting for your approval' : 'Nothing to review', Icon: IconHourglass, warn: pendingVerifications.length > 0 },
                        { label: 'Setup incomplete', value: incompleteProfiles.length, note: 'Signed in, profile not finished', Icon: IconLayers },
                        { label: 'Programs', value: new Set(results.map((st) => st.program_id).filter(Boolean)).size, note: 'With enrolled students', Icon: IconBuilding },
                    ]}
                />
            )}

            {pendingVerifications.length > 0 && (
                <>
                    <h2 className="ui-section-title" style={{ marginBottom: 6 }}>Pending Verification <span className="ui-chip-count">{pendingVerifications.length}</span></h2>
                    <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
                        New registrations in your assigned program(s), waiting for you to confirm enrollment.
                    </p>

                    {pendingVerifications.map((student) => (
                        <div className="employee-list-card" key={student.student_id}>
                            <div className="employee-list-card-header">
                                <div className="ui-card-title" style={{ alignItems: 'center' }}>
                                    <span className="ui-avatar" aria-hidden="true"><AvatarFace photo={student.photoUrl} name={student.fullName} /></span>
                                    <div>
                                        <h3>{student.fullName}</h3>
                                        <p>{student.student_number} · {student.email}</p>
                                    </div>
                                </div>
                                <span className="employee-status-pill status-pending">pending</span>
                            </div>

                            <div className="employee-info-grid">
                                <div className="employee-info-field">
                                    <span>College</span>
                                    <strong>{student.collegeName || 'N/A'}</strong>
                                </div>
                                <div className="employee-info-field">
                                    <span>Program</span>
                                    <strong>{student.programName || 'N/A'}</strong>
                                </div>
                                <div className="employee-info-field">
                                    <span>{student.student_type === 'alumni' ? 'Alumni' : 'Year Level'}</span>
                                    <strong>{student.student_type === 'alumni' ? `Class of ${student.graduation_year || '—'}` : student.year_level || 'N/A'}</strong>
                                </div>
                            </div>

                            <div className="ui-card-actions">
                                <button
                                    className="employee-link-button"
                                    onClick={() => navigate(`/employee/students/${student.student_id}`)}
                                >
                                    View full details →
                                </button>

                                <button
                                    className="employee-link-button is-success"
                                    onClick={() => approveStudent(student)}
                                    disabled={reviewingId === student.student_id}
                                >
                                    {reviewingId === student.student_id ? 'Working...' : 'Approve'}
                                </button>

                                <button
                                    className="employee-link-button is-danger"
                                    onClick={() => rejectStudent(student)}
                                    disabled={reviewingId === student.student_id}
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {incompleteProfiles.length > 0 && (
                <>
                    <h2 className="ui-section-title" style={{ marginBottom: 6, marginTop: pendingVerifications.length > 0 ? 28 : 0 }}>Setup Incomplete <span className="ui-chip-count">{incompleteProfiles.length}</span></h2>
                    <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
                        These students signed in but haven't finished the "Complete your profile" step, so they don't have a student record yet and can't submit requests.
                        Accounts left incomplete for 3 working days are automatically deactivated.
                    </p>

                    {incompleteProfiles.map((p) => (
                        <div className="employee-list-card" key={p.user_id}>
                            <div className="employee-list-card-header">
                                <div className="ui-card-title" style={{ alignItems: 'center' }}>
                                    <span className="ui-avatar is-muted" aria-hidden="true"><AvatarFace photo={p.profile_photo_url} name={incompleteName(p)} /></span>
                                    <div>
                                        <h3>{incompleteName(p)}</h3>
                                        <p>{p.email}</p>
                                    </div>
                                </div>
                                {p.status === 'inactive' ? (
                                    <span className="employee-status-pill status-rejected">Auto-declined</span>
                                ) : (
                                    <span className="employee-status-pill status-pending">Setup incomplete</span>
                                )}
                            </div>

                            <div className="employee-info-grid">
                                <div className="employee-info-field">
                                    <span>Full name</span>
                                    <strong>{incompleteFullName(p)}</strong>
                                </div>
                                <div className="employee-info-field">
                                    <span>Email</span>
                                    <strong>{p.email || 'N/A'}</strong>
                                </div>
                                <div className="employee-info-field">
                                    <span>Phone</span>
                                    <strong>{p.phone_number || 'Not given yet'}</strong>
                                </div>
                                <div className="employee-info-field">
                                    <span>Signed up</span>
                                    <strong>{new Date(p.created_at).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>
                                </div>
                                <div className="employee-info-field">
                                    <span>Missing</span>
                                    <strong>Student number, college and program</strong>
                                </div>
                                <div className="employee-info-field">
                                    <span>Account</span>
                                    <strong>{p.status === 'inactive' ? 'Deactivated after 3 working days' : 'Active, waiting to finish'}</strong>
                                </div>
                            </div>

                            <div className="ui-card-actions">
                                <button
                                    className="employee-link-button is-danger"
                                    onClick={() => deleteIncompleteProfile(p)}
                                    disabled={deletingProfileId === p.user_id}
                                >
                                    {deletingProfileId === p.user_id ? 'Deleting...' : 'Delete account'}
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {(pendingVerifications.length > 0 || incompleteProfiles.length > 0) && (
                <h2 style={{ fontSize: 17, margin: '28px 0 14px' }}>Students</h2>
            )}

            <form onSubmit={(e) => e.preventDefault()} style={{ marginBottom: 16 }}>
                <input
                    className="employee-search-input ui-search-field"
                    type="search"
                    value={term}
                    onChange={(e) => { setTerm(e.target.value); setSelectedProgramKey(null) }}
                    placeholder="Type a student's name or student number"
                    aria-label="Search students by name or student number"
                    style={{ width: '100%' }}
                />
            </form>

            <div className="employee-filter-row" style={{ marginBottom: 24 }}>
                {[
                    { key: 'all', label: 'All Years' },
                    { key: '1', label: '1st Year' },
                    { key: '2', label: '2nd Year' },
                    { key: '3', label: '3rd Year' },
                    { key: '4', label: '4th Year' },
                    { key: '5', label: '5th Year' },
                    { key: 'alumni', label: 'Alumni' },
                ].map((chip) => (
                    <button
                        key={chip.key}
                        type="button"
                        className={`employee-filter-chip${yearLevelFilter === chip.key ? ' active' : ''}`}
                        onClick={() => { setYearLevelFilter(chip.key); setSelectedProgramKey(null) }}
                    >
                        {chip.label}<span className="ui-chip-count">{chip.key === 'all'
                            ? results.length
                            : chip.key === 'alumni'
                                ? results.filter((st) => st.student_type === 'alumni').length
                                : results.filter((st) => st.student_type !== 'alumni' && String(st.year_level) === chip.key).length}</span>
                    </button>
                ))}
            </div>

            {error && <div className="employee-error-box">{error}</div>}

            {loading ? (
                <SkeletonTable portal="employee" columns={['College', 'Course', 'Students', '']} rows={5} />
            ) : term.trim() ? (
                matches.length === 0 && incompleteMatches.length === 0 ? (
                    <div className="employee-empty">No students matched "{term.trim()}".</div>
                ) : (
                    <div className="employee-table-wrapper">
                        <table className="employee-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Student No.</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {matches.map((student) => (
                                    <tr
                                        key={student.student_id}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/employee/students/${student.student_id}`)}
                                    >
                                        <td><strong>{student.fullName}</strong></td>
                                        <td>{student.student_number || '—'}</td>
                                        <td><span className="employee-link-button">View →</span></td>
                                    </tr>
                                ))}
                                {incompleteMatches.map((p) => (
                                    <tr key={p.user_id}>
                                        <td><strong>{incompleteName(p)}</strong></td>
                                        <td><span className="employee-status-pill status-pending">Setup incomplete</span></td>
                                        <td style={{ color: 'var(--slate)', fontSize: 12.5 }}>No student record yet</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : results.length === 0 ? (
                <div className="employee-empty">No students found.</div>
            ) : selectedGroup ? (
                <>
                    <button
                        className="employee-link-button"
                        style={{ marginBottom: 16 }}
                        onClick={() => setSelectedProgramKey(null)}
                    >
                        ← Back to Colleges & Courses
                    </button>

                    <div className="employee-page-header-row" style={{ marginBottom: 14 }}>
                        <h2 style={{ fontSize: 16 }}>
                            {selectedGroup.programName}
                            {selectedGroup.collegeName && <span style={{ color: 'var(--slate)', fontWeight: 400 }}> · {selectedGroup.collegeName}</span>}
                        </h2>
                        <span className="employee-status-pill status-pending">
                            {selectedGroup.students.length} student{selectedGroup.students.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {selectedGroup.students.map(renderStudentCard)}
                </>
            ) : (
                <div className="employee-table-wrapper">
                    <table className="employee-table">
                        <thead>
                            <tr>
                                <th>College</th>
                                <th>Course</th>
                                <th>Students</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedResults.map((group) => (
                                <tr
                                    key={group.key}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedProgramKey(group.key)}
                                >
                                    <td>{group.collegeName}</td>
                                    <td>{group.programName}</td>
                                    <td>{group.students.length}</td>
                                    <td>
                                        <span className="employee-link-button">View →</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default Students
