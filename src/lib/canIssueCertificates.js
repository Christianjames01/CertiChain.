import { supabase } from './supabase'

// Whether the signed-in employee may create Certificates of Enrollment --
// a permission the registrar head grants per employee (employees.
// can_issue_certificates). The real enforcement is the insert policy on
// enrollment_certificates (20261012030000); this just shows/hides the page.
// Before that migration exists, falls back to the old rule: full-access
// employees only.
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
