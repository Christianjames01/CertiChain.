import { Link } from 'react-router-dom'
import './EmptyState.css'

// A helpful empty state: what's missing, why, and what to do. Shared by
// the student, employee, and admin/head portals so "no data yet" looks
// the same everywhere instead of each portal inventing its own box.
export function EmptyState({ icon, title, text, action }) {
    return (
        <div className="ui-empty-state">
            {icon && <span className="ui-empty-state-icon" aria-hidden="true">{icon}</span>}
            <strong>{title}</strong>
            {text && <p>{text}</p>}
            {action && (action.to
                ? <Link to={action.to} className="ui-empty-state-btn">{action.label}</Link>
                : <button type="button" className="ui-empty-state-btn" onClick={action.onClick}>{action.label}</button>)}
        </div>
    )
}

export default EmptyState
