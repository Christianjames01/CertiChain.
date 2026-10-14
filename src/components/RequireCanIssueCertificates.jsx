import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { loadCanIssueCertificates } from '../lib/canIssueCertificates'
import { SkeletonPageContent } from './Skeleton'

function RequireCanIssueCertificates({ children }) {
    const [allowed, setAllowed] = useState(null)

    useEffect(() => {
        loadCanIssueCertificates().then(setAllowed)
    }, [])

    if (allowed === null) {
        return <SkeletonPageContent />
    }

    if (!allowed) {
        return <Navigate to="/employee/dashboard" replace />
    }

    return children
}

export default RequireCanIssueCertificates
