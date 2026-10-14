import { supabase } from './supabase'
import { loadDirectoryProfiles } from './directoryProfiles'

export const REGISTRAR_LABEL = 'HCDC-Registrar'

export async function buildSenderLabels(userIds, { showRegistrarHeadName = false } = {}) {
    if (userIds.length === 0) return {}

    const [profiles, { data: employees }] = await Promise.all([
        loadDirectoryProfiles(userIds),
        supabase.from('employees').select('user_id, display_name').in('user_id', userIds),
    ])

    const displayNameByUserId = Object.fromEntries((employees || []).map((e) => [e.user_id, e.display_name]))

    const labels = {}

    for (const p of profiles || []) {
        const realName = `${p.first_name} ${p.last_name}`.trim()

        if ((p.role === 'registrar_head' || p.role === 'admin') && !showRegistrarHeadName) {
            labels[p.user_id] = REGISTRAR_LABEL
        } else if (p.role === 'employee') {
            labels[p.user_id] = displayNameByUserId[p.user_id]?.trim() || realName
        } else {
            labels[p.user_id] = realName
        }
    }

    return labels
}
