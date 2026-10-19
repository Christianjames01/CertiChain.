import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import certichainLogo from '../../assets/certichain-logo.png'
import { IconHome, IconCalendar, IconReceipt, IconBell, IconUserCircle, IconLogout, IconMenu, IconX, IconBook } from '../student/icons'
import { IconClipboardList, IconUsers, IconMessage, IconHistory, IconShieldCheck } from '../employee/icons'
import { IconSwap, IconIdCard, IconDocument, IconBuilding, IconBarChart, IconMegaphone, IconTicket, IconClipboardCheck, IconLayers } from './icons'
import ThemeToggle from '../../components/ThemeToggle'
import '../../components/NavStages.css'
import './AdminLayout.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import PageLoading from '../../components/PageLoading'
import { adminPath } from '../../lib/portalPaths'

const HIDDEN_FOR_SUPERADMIN = ['/announcements', '/queue', '/guide', '/profile']

const NAV_ITEMS = [
    { to: '/dashboard', label: 'Dashboard', icon: <IconHome />, end: true, stage: 'overview' },
    { to: '/requests', label: 'All Requests', icon: <IconClipboardList />, stage: 'todo' },
    { to: '/assignments', label: 'Request Assignments', icon: <IconSwap />, stage: 'todo' },
    { to: '/receipts', label: 'Official Receipts', icon: <IconReceipt />, badgeKey: 'uploadedReceipts', stage: 'todo' },
    { to: '/request-handling', label: 'Request Handling', icon: <IconLayers />, stage: 'progress' },
    { to: '/claim-schedules', label: 'Claim Schedules', icon: <IconCalendar />, badgeKey: 'unclaimed', stage: 'progress' },
    { to: '/credentials', label: 'Credentials', icon: <IconShieldCheck />, stage: 'done' },
    { to: '/issued-certificates', label: 'Issued Certificates', icon: <IconClipboardCheck />, stage: 'done' },
    { to: '/digital-certificates', label: 'Digital Certificates', icon: <IconShieldCheck />, stage: 'done' },
    { to: '/reports', label: 'Reports', icon: <IconBarChart />, stage: 'done' },
    { to: '/activity-logs', label: 'Activity Logs', icon: <IconHistory />, stage: 'done' },
    { to: '/employees', label: 'Employees', icon: <IconUsers />, stage: 'manage' },
    { to: '/students', label: 'Students', icon: <IconIdCard />, badgeKey: 'pendingStudents', stage: 'manage' },
    { to: '/documents', label: 'Documents', icon: <IconDocument />, stage: 'manage' },
    { to: '/announcements', label: 'Announcements', icon: <IconMegaphone />, stage: 'manage' },
    { to: '/colleges-programs', label: 'Academic Divisions & Programs', icon: <IconBuilding />, stage: 'manage' },
    { to: '/office-calendar', label: 'Office Calendar', icon: <IconCalendar />, stage: 'manage' },
    { to: '/queue', label: 'Walk-in Queue', icon: <IconTicket />, stage: 'manage' },
    { to: '/messages', label: 'Messages', icon: <IconMessage />, badgeKey: 'messages', stage: 'account' },
    { to: '/notifications', label: 'Notifications', icon: <IconBell />, badgeKey: 'notifications', stage: 'account' },
    { to: '/guide', label: 'User Guide', icon: <IconBook />, stage: 'account' },
    { to: '/profile', label: 'Profile', icon: <IconUserCircle />, stage: 'account' },
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

function AdminLayout() {
    const navigate = useNavigate()
    const [name, setName] = useState('')
    const [initials, setInitials] = useState('')
    const [roleLabel, setRoleLabel] = useState('')
    const [role, setRole] = useState('')
    const [unreadNotifications, setUnreadNotifications] = useState(0)
    const [unreadMessages, setUnreadMessages] = useState(0)
    const [pendingStudents, setPendingStudents] = useState(0)
    const [unclaimed, setUnclaimed] = useState(0)
    const [uploadedReceipts, setUploadedReceipts] = useState(0)
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    useLiveRefresh(
        ['notifications', 'messages', 'students', 'document_requests', 'claim_schedules', 'official_receipts'],
        () => loadBadgeCounts()
    )

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
            .select('first_name, last_name, role')
            .eq('user_id', user.id)
            .single()

        if (profile) {
            setName(`${profile.first_name} ${profile.last_name}`.trim())
            setInitials(
                `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
            )
            setRole(profile.role)
            setRoleLabel(
                profile.role === 'admin' ? 'System Admin'
                    : profile.role === 'superadmin' ? 'Superadmin (view only)'
                        : 'Registrar Head'
            )
        }
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

        const { count: pendingCount } = await supabase
            .from('students')
            .select('student_id', { count: 'exact', head: true })
            .eq('verification_status', 'pending')

        setPendingStudents(pendingCount || 0)

        const { data: readyRequests } = await supabase
            .from('document_requests')
            .select('request_id')
            .eq('status', 'ready_for_claiming')

        const readyIds = (readyRequests || []).map((r) => r.request_id)

        if (readyIds.length > 0) {
            const { data: scheduled } = await supabase
                .from('claim_schedules')
                .select('request_id')
                .in('request_id', readyIds)
                .neq('status', 'cancelled')

            const scheduledIds = new Set((scheduled || []).map((s) => s.request_id))
            setUnclaimed(readyIds.filter((id) => !scheduledIds.has(id)).length)
        } else {
            setUnclaimed(0)
        }

        const { count: uploadedCount } = await supabase
            .from('official_receipts')
            .select('receipt_id', { count: 'exact', head: true })
            .eq('status', 'uploaded')

        setUploadedReceipts(uploadedCount || 0)
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
        if (key === 'unclaimed') return unclaimed
        if (key === 'uploadedReceipts') return uploadedReceipts
        return 0
    }

    const closeMobileNav = () => setMobileNavOpen(false)

    return (
        <div className="admin-layout">

            <ThemeToggle />

            <header className="admin-mobile-topbar">
                <button
                    className="admin-mobile-menu-button"
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open menu"
                >
                    <IconMenu />
                </button>

                <Link to={adminPath('/dashboard')} className="admin-mobile-brand">
                    <img src={certichainLogo} alt="" />
                    <span>CertiChain</span>
                </Link>
            </header>

            {mobileNavOpen && (
                <div className="admin-nav-backdrop" onClick={closeMobileNav} />
            )}

            <aside className={`admin-sidebar${mobileNavOpen ? ' open' : ''}`}>

                <div className="admin-sidebar-top">
                    <div className="admin-sidebar-brand-row">
                        <Link to={adminPath('/dashboard')} className="admin-sidebar-brand" onClick={closeMobileNav}>
                            <div className="admin-sidebar-seal">
                                <img src={certichainLogo} alt="Holy Cross of Davao College" />
                            </div>
                            <div>
                                <div className="admin-sidebar-name">CertiChain</div>
                                <div className="admin-sidebar-subtitle">Registrar Head Portal</div>
                            </div>
                        </Link>

                        <button
                            className="admin-mobile-close-button"
                            onClick={closeMobileNav}
                            aria-label="Close menu"
                        >
                            <IconX />
                        </button>
                    </div>

                    <nav className="admin-nav">
                        {(() => {
                            const visible = NAV_ITEMS.filter((item) => role !== 'superadmin' || !HIDDEN_FOR_SUPERADMIN.includes(item.to))
                            const renderItem = (item) => {
                            const count = item.badgeKey ? badgeValue(item.badgeKey) : 0

                            return (
                                <NavLink
                                    key={item.to}
                                    to={adminPath(item.to)}
                                    end={item.end}
                                    onClick={closeMobileNav}
                                    className={({ isActive }) =>
                                        `admin-nav-link${isActive ? ' active' : ''}`
                                    }
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                    {count > 0 && (
                                        <span className="admin-nav-badge">
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

                <div className="admin-sidebar-bottom">
                    <div className="admin-user">
                        <div className="admin-user-avatar">{initials || 'RH'}</div>
                        <div>
                            <div className="admin-user-name">{name || 'Registrar Head'}</div>
                            <div className="admin-user-role">{roleLabel || 'Registrar Head'}</div>
                        </div>
                    </div>

                    <button className="admin-logout-button" onClick={handleLogout} disabled={loggingOut}>
                        {loggingOut ? <span className="icon-spinner" /> : <IconLogout />}
                        <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
                    </button>
                </div>

            </aside>

            <main className="admin-content">
                {role === 'superadmin' && (
                    <div className="admin-readonly-banner" role="status">
                        <span>
                            You're viewing the registrar head's portal as superadmin. Nothing here can be
                            changed from this account — edits, approvals, and deletions are blocked.
                        </span>
                        <Link to="/superadmin" className="admin-readonly-banner-link">← Back to Dashboard</Link>
                    </div>
                )}
                <Suspense fallback={<PageLoading inline />}><Outlet context={{ role }} /></Suspense>
            </main>

        </div>
    )
}

export default AdminLayout
