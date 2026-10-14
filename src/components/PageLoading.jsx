import './PageLoading.css'

function PageLoading({ inline = false }) {
    return (
        <div className={`page-loading${inline ? ' is-inline' : ''}`} role="status" aria-label="Loading">
            <span className="page-loading-bar" />
        </div>
    )
}

export default PageLoading
