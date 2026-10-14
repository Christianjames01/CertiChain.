import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import certichainLogo from '../../assets/certichain-logo.png'
import { IconHome, IconCalendar, IconBell, IconUserCircle, IconLogout, IconMenu, IconX, IconBook } from '../student/icons'
import { IconClipboardList, IconShieldCheck, IconGear, IconMessage, IconHistory } from './icons'
import { IconIdCard, IconTicket, IconUsers, IconDocument, IconClipboardCheck } from '../admin/icons'
import ThemeToggle from '../../components/ThemeToggle'
import '../../components/DashboardStats.css'
import '../../components/PortalUi.css'
import '../../components/NavStages.css'
import './EmployeeLayout.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import PageLoading from '../../components/PageLoading'
import { loadCanIssueCertificates } from '../../lib/canIssueCertificates'

const NAV_ITEMS = [
    { to: '/employee/dashboard', label: 'Dashboard', icon: <IconHome />, end: true, stage: 'overview' },
    { to: '/employee/requests', label: 'Assigned Requests', icon: <IconClipboardList />, stage: 'overview' },
    { to: '/employee/verification', label: 'Request Verification', icon: <IconShieldCheck />, fullAccessOnly: true, stage: 'todo' },
    { to: '/employee/processing', label: 'Document Processing', icon: <IconGear />, fullAccessOnly: true, stage: 'progress' },
    { to: '/employee/claim-schedule', label: 'Claim Schedule', icon: <IconCalendar />, stage: 'progress' },
    { to: '/employee/activity-logs', label: 'Activity Logs', icon: <IconHistory />, fullAccessOnly: true, stage: 'done' },
    { to: '/employee/certificate-of-enrollment', label: 'Certificate of Enrollment', icon: <IconClipboardCheck />, canIssueCertificatesOnly: true, stage: 'generate' },
    { to: '/employee/transcript-of-records', label: 'Transcript of Records', icon: <IconDocument />, canIssueCertificatesOnly: true, stage: 'generate' },
    { to: '/employee/students', label: 'Students', icon: <IconIdCard />, fullAccessOnly: true, badgeKey: 'pendingStudents', stage: 'manage' },
    { to: '/employee/documents', label: 'Documents', icon: <IconDocument />, stage: 'manage' },
    { to: '/employee/office-calendar', label: 'Office Calendar', icon: <IconCalendar />, stage: 'manage' },
    { to: '/employee/queue', label: 'Walk-in Queue', icon: <IconTicket />, fullAccessOnly: true, stage: 'manage' },
    { to: '/employee/add-employee', label: 'Add Employee', icon: <IconUsers />, canAddEmployeesOnly: true, stage: 'manage' },
    { to: '/employee/messages', label: 'Messages', icon: <IconMessage />, badgeKey: 'messages', fullAccessOnly: true, stage: 'account' },
    { to: '/employee/notifications', label: 'Notifications', icon: <IconBell />, badgeKey: 'notifications', stage: 'account' },
    { to: '/employee/guide', label: 'User Guide', icon: <IconBook />, stage: 'account' },
    { to: '/employee/profile', label: 'Profile', icon: <IconUserCircle />, stage: 'account' },
]

const NAV_STAGES = [
    { key: 'overview', label: 'Overview' },
    { key: 'todo', label: 'To do' },
    { key: 'progress', label: 'In progress' },
    { key: 'done', label: 'Done' },
    { key: 'generate', label: 'Generate' },
    { key: 'manage', label: 'Manage' },
    { key: 'account', label: 'Account' },
]

function EmployeeLayout() {
    const navigate = useNavigate()
    const [name, setName] = useState('')
    const [initials, setInitials] = useState('')
    const [positionTitle, setPositionTitle] = useState('')
    const [accessScope, setAccessScope] = useState('full')
    const [canAddEmployees, setCanAddEmployees] = useState(false)
    const [canIssueCertificates, setCanIssueCertificates] = useState(false)
    const [unreadNotifications, setUnreadNotifications] = useState(0)
    const [unreadMessages, setUnreadMessages] = useState(0)
    const [pendingStudents, setPendingStudents] = useState(0)
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    useLiveRefresh(['notifications', 'messages', 'students', 'employee_assignments'], () => loadBadgeCounts())
    useLiveRefresh(['employees', 'notifications'], () => loadProfile())

    useEffect(() => {
        document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [mobileNavOpen])

    useEffect(() => {
        loadProfile()
        loadBadgeCounts()

        window.addEventListener('notifications-updated', loadBadgeCounts)
        window.addEventListener('messages-updated', loadBadgeCounts)
        return () => {
            window.removeEventListener('notifications-updated', loadBadgeCounts)
            window.removeEventListener('messages-updated', loadBadgeCounts)
        }
    }, [])

    async function loadProfile() {
        const {
            data: { user }
        } = await supabase.auth.getUser()

        if (!user) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', user.id)
            .single()

        if (profile) {
            setName(`${profile.first_name} ${profile.last_name}`.trim())
            setInitials(
                `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
            )
        }

        const { data: employee } = await supabase
            .from('employees')
            .select('position_title, access_scope, can_add_employees')
            .eq('user_id', user.id)
            .single()

        if (employee) {
            setPositionTitle(employee.position_title || '')
            setAccessScope(employee.access_scope || 'full')
            setCanAddEmployees(!!employee.can_add_employees)
        }

        setCanIssueCertificates(await loadCanIssueCertificates())
    }

    async function loadBadgeCounts() {
        const {
            data: { user }
        } = await supabase.auth.getUser()

        if (!user) return

        const { count: notificationCount } = await supabase
            .from('notifications')
            .select('notification_id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false)

        setUnreadNotifications(notificationCount || 0)

        const { count: messageCount } = await supabase
            .from('messages')
            .select('message_id', { count: 'exact', head: true })
            .eq('receiver_user_id', user.id)
            .eq('is_read', false)

        setUnreadMessages(messageCount || 0)

        const { data: employee } = await supabase
            .from('employees')
            .select('employee_id')
            .eq('user_id', user.id)
            .maybeSingle()

        if (employee) {
            const { data: assignments } = await supabase
                .from('employee_assignments')
                .select('college_id, program_id')
                .eq('employee_id', employee.employee_id)
                .eq('status', 'active')

            const assignedPairs = new Set((assignments || []).map((a) => `${a.college_id}:${a.program_id}`))

            if (assignedPairs.size > 0) {
                const { data: pending } = await supabase
                    .from('students')
                    .select('college_id, program_id')
                    .eq('verification_status', 'pending')

                const mine = (pending || []).filter((s) => assignedPairs.has(`${s.college_id}:${s.program_id}`))
                setPendingStudents(mine.length)
            } else {
                setPendingStudents(0)
            }
        }
    }

    const handleLogout = async () => {
        setLoggingOut(true)
        await supabase.auth.signOut()
        navigate('/', { replace: true })
    }

    const badgeValue = (key) => {
        if (key === 'notifications') return unreadNotifications
        if (key === 'messages') return unreadMessages
        if (key === 'pendingStudents') return pendingStudents
        return 0
    }

    const closeMobileNav = () => setMobileNavOpen(false)

    return (
        <div className="employee-layout">

            <ThemeToggle />

            <header className="employee-mobile-topbar">
                <button
                    className="employee-mobile-menu-button"
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open menu"
                >
                    <IconMenu />
                </button>

                <Link to="/employee/dashboard" className="employee-mobile-brand">
                    <img src={certichainLogo} alt="" />
                    <span>CertiChain</span>
                </Link>
            </header>

            {mobileNavOpen && (
                <div className="employee-nav-backdrop" onClick={closeMobileNav} />
            )}

            <aside className={`employee-sidebar${mobileNavOpen ? ' open' : ''}`}>

                <div className="employee-sidebar-top">
                    <div className="employee-sidebar-brand-row">
                        <Link to="/employee/dashboard" className="employee-sidebar-brand" onClick={closeMobileNav}>
                            <div className="employee-sidebar-seal">
                                <img src={certichainLogo} alt="Holy Cross of Davao College" />
                            </div>
                            <div>
                                <div className="employee-sidebar-name">CertiChain</div>
                                <div className="employee-sidebar-subtitle">Registrar Employee Portal</div>
                            </div>
                        </Link>

                        <button
                            className="employee-mobile-close-button"
                            onClick={closeMobileNav}
                            aria-label="Close menu"
                        >
                            <IconX />
                        </button>
                    </div>

                    <nav className="employee-nav">
                        {(() => {
                            const visible = NAV_ITEMS.filter((item) =>
                            (!item.fullAccessOnly || accessScope === 'full') &&
                            (!item.canAddEmployeesOnly || canAddEmployees) &&
                            (!item.canIssueCertificatesOnly || canIssueCertificates)
                        )
                            const renderItem = (item) => {
                            const count = item.badgeKey ? badgeValue(item.badgeKey) : 0

                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    onClick={closeMobileNav}
                                    className={({ isActive }) =>
                                        `employee-nav-link${isActive ? ' active' : ''}`
                                    }
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                    {count > 0 && (
                                        <span className="employee-nav-badge">
                                            {count > 9 ? '9+' : count}
                                        </span>
                                    )}
                                </NavLink>
                            )
                        }
                            return NAV_STAGES.map((stage) => {
                                const items = visible.filter((item) => item.stage === stage.key)
                                if (items.length === 0) return null
                                return (
                                    <div className="nav-stage" data-stage={stage.key} key={stage.key}>
                                        <span className="nav-stage-label" data-stage={stage.key}>{stage.label}</span>
                                        {items.map(renderItem)}
                                    </div>
                                )
                            })
                        })()}
                    </nav>
                </div>

                <div className="employee-sidebar-bottom">
                    <div className="employee-user">
                        <div className="employee-user-avatar">{initials || 'EM'}</div>
                        <div>
                            <div className="employee-user-name">{name || 'Employee'}</div>
                            <div className="employee-user-role">{positionTitle || 'Registrar Staff'}</div>
                        </div>
                    </div>

                    <button className="employee-logout-button" onClick={handleLogout} disabled={loggingOut}>
                        {loggingOut ? <span className="icon-spinner" /> : <IconLogout />}
                        <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
                    </button>
                </div>

            </aside>

            <main className="employee-content">
                <Suspense fallback={<PageLoading inline />}><Outlet /></Suspense>
            </main>

        </div>
    )
}

export default EmployeeLayout
