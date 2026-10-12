import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { loadCanIssueCertificates } from '../lib/canIssueCertificates'
import { SkeletonPageContent } from './Skeleton'

// Gates /employee/certificate-of-enrollment to employees the registrar head
// has allowed to create certificates. Server-side the insert policy on
// enrollment_certificates checks the same flag -- this just keeps an
// employee without the grant off a page they can't use.
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
