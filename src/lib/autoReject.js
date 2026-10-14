import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const AUTO_REJECT_DAYS = 7
export const AUTO_DELETE_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000
const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY_MS)

function kindOf(request) {
    if (request?.status === 'lacking_requirements' && request.flagged_at) return 'flagged'
    if (['pending', 'payment_pending'].includes(request?.status) && request.unpaid_since) return 'unpaid'
    return null
}

export function useAutoReject(request) {
    const kind = kindOf(request)
    const requestId = request?.request_id
    const version = request?.updated_at
    const [receiptCheck, setReceiptCheck] = useState({ key: null, has: false })
    const key = kind ? `${requestId}:${version}` : null

    useEffect(() => {
        if (!key) return undefined
        let cancelled = false
        supabase
            .from('official_receipts')
            .select('receipt_id', { count: 'exact', head: true })
            .eq('request_id', requestId)
            .then(({ count, error }) => {
                if (!cancelled) setReceiptCheck({ key, has: !!error || (count || 0) > 0 })
            })
        return () => { cancelled = true }
    }, [key, requestId])

    const since = kind === 'flagged' ? request.flagged_at : kind === 'unpaid' ? request.unpaid_since : null
    const applies = !!kind && receiptCheck.key === key && !receiptCheck.has

    return {
        kind: applies ? kind : null,
        since: applies ? since : null,
        rejectOn: applies ? addDays(since, AUTO_REJECT_DAYS) : null,
        deleteOn: request?.status === 'rejected' && request.auto_rejected_at
            ? addDays(request.auto_rejected_at, AUTO_DELETE_DAYS)
            : null,
    }
}
