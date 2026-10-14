import { supabase } from './supabase'

export async function loadCanIssueCertificates() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data, error } = await supabase
        .from('employees')
        .select('can_issue_certificates')
        .eq('user_id', user.id)
        .maybeSingle()

    if (!error) return !!data?.can_issue_certificates

    const { data: fallback } = await supabase
        .from('employees')
        .select('access_scope')
        .eq('user_id', user.id)
        .maybeSingle()

    return fallback?.access_scope === 'full'
}
