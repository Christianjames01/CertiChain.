import { supabase } from './supabase'
import { loadDirectoryProfiles } from './directoryProfiles'

export const HANDOFF_STAGES = {
    assigned: 'Assigned',
    processing: 'Processing',
    production: 'Production',
    claiming: 'Claiming section',
}

export async function loadEmployeeNames(employeeIds) {
    const ids = [...new Set((employeeIds || []).filter(Boolean))]
    if (ids.length === 0) return {}

    const { data: employees } = await supabase
        .from('employees')
        .select('employee_id, user_id, employee_number, position_title, access_scope')
        .in('employee_id', ids)

    const profiles = await loadDirectoryProfiles((employees || []).map((e) => e.user_id))
    const profileByUser = Object.fromEntries(profiles.map((p) => [p.user_id, p]))

    return Object.fromEntries((employees || []).map((e) => {
        const p = profileByUser[e.user_id]
        const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : ''
        return [e.employee_id, {
            name: name || e.employee_number || 'Employee',
            position: e.position_title || '',
            scope: e.access_scope || 'full',
            userId: e.user_id,
        }]
    }))
}
