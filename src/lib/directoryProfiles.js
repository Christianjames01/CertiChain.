import { supabase } from './supabase'

export async function loadDirectoryProfiles(userIds) {
    const ids = [...new Set((userIds || []).filter(Boolean))]
    if (ids.length === 0) return []

    const { data, error } = await supabase.rpc('directory_profiles', { p_user_ids: ids })
    if (!error) return data || []

    const { data: rows } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, role, profile_photo_url')
        .in('user_id', ids)
    return rows || []
}
