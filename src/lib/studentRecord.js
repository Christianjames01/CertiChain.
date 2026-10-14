import { supabase } from './supabase'

const OPTIONAL_COLUMNS = ['birth_place', 'parent_guardian']

const isMissingColumn = (error) =>
    !!error && (error.code === 'PGRST204' || error.code === '42703' || OPTIONAL_COLUMNS.some((c) => (error.message || '').includes(c)))

const withoutOptional = (row) => {
    const rest = { ...row }
    OPTIONAL_COLUMNS.forEach((c) => delete rest[c])
    return rest
}

export async function insertStudentRow(row) {
    const result = await supabase.from('students').insert(row)
    if (!isMissingColumn(result.error)) return result
    return supabase.from('students').insert(withoutOptional(row))
}

export async function updateStudentRow(studentId, changes) {
    const result = await supabase.from('students').update(changes).eq('student_id', studentId)
    if (!isMissingColumn(result.error)) return result
    return supabase.from('students').update(withoutOptional(changes)).eq('student_id', studentId)
}
