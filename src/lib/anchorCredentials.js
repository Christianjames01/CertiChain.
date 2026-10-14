import { supabase } from './supabase'

export function startBlockchainRecording() {
    supabase.functions.invoke('anchor-credentials', { body: {} }).then(
        () => {},
        () => {}
    )
}
