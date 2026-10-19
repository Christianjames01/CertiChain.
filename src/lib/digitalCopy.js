import { supabase } from './supabase'
import { notifyError } from './notify'

export async function downloadDigitalCopy(path, credentialNumber) {
    const { data, error } = await supabase.storage
        .from('digital-credentials')
        .createSignedUrl(path, 120, { download: `${credentialNumber || 'credential'}.pdf` })
    if (error || !data?.signedUrl) {
        console.error('DIGITAL COPY DOWNLOAD ERROR:', error)
        notifyError('The digital copy could not be downloaded. Please try again.')
        return
    }
    window.location.assign(data.signedUrl)
}
