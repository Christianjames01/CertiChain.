import { Skeleton } from './Skeleton'
import './DashboardStats.css'

// Summary tiles at the top of admin list pages, in the same style as the
// head's dashboard. stats: [{ label, value, note?, Icon?, warn?, onClick? }].
// A tile with onClick is a button (e.g. to switch a filter).
//
// loading: draws placeholder tiles in the same grid (one per stat), so the
// tiles keep their space while the page loads instead of popping in.
function PageStats({ stats, loading = false }) {
    if (loading) {
        return (
            <div className="dash-overview-grid page-stats" role="status" aria-busy="true" aria-label="Loading">
                {stats.map((stat, i) => (
                    <div key={stat.label} className="dash-stat-tile dash-overview-tile is-static skeleton-card" style={{ animationDelay: `${i * 60}ms` }}>
                        <div className="dash-stat-top">
                            <span className="dash-stat-label">{stat.label}</span>
                            {stat.Icon && (
                                <span className="dash-stat-icon dash-stat-icon-brand" aria-hidden="true"><stat.Icon /></span>
                            )}
                        </div>
                        <Skeleton width={56} height={38} radius={8} style={{ margin: '2px 0 4px' }} />
                        {stat.note !== undefined && <Skeleton width="62%" height={13} />}
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="dash-overview-grid page-stats">
            {stats.map((stat) => {
                const Tag = stat.onClick ? 'button' : 'div'
                return (
                    <Tag
                        key={stat.label}
                        type={stat.onClick ? 'button' : undefined}
                        onClick={stat.onClick}
                        className={`dash-stat-tile dash-overview-tile${stat.warn ? ' is-warn' : ''}${stat.onClick ? '' : ' is-static'}`}
                    >
                        <div className="dash-stat-top">
                            <span className="dash-stat-label">{stat.label}</span>
                            {stat.Icon && (
                                <span className="dash-stat-icon dash-stat-icon-brand" aria-hidden="true"><stat.Icon /></span>
                            )}
                        </div>
                        <span className="dash-stat-value dash-stat-value-lg">{stat.value}</span>
                        {stat.note && <span className="dash-stat-note">{stat.note}</span>}
                    </Tag>
                )
            })}
        </div>
    )
}

export default PageStats
