import { supabase } from './supabase'
import { startBlockchainRecording } from './anchorCredentials'

export function newSealCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(6))
    return 'DOC-' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export async function sealPrintedDocument({ code, docType, title, studentName, content, sourceId }) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('document_seals').insert({
        seal_code: code,
        doc_type: docType,
        title,
        student_name: studentName,
        content,
        source_id: sourceId || null,
        issued_by: user?.id,
    })
    if (error) return error
    startBlockchainRecording()
    return null
}
