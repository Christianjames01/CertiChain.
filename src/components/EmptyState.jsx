import { Link } from 'react-router-dom'
import './EmptyState.css'

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
