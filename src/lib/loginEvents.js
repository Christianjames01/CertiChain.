import { supabase } from './supabase'

export async function recordLoginEvent() {
    const { error } = await supabase.rpc('record_login_event')
    if (error) console.warn('Could not record login event:', error.message)
}
