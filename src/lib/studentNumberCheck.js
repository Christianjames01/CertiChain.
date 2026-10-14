import { supabase } from './supabase'

export async function isStudentNumberTaken(studentNumber) {
    const value = (studentNumber || '').trim()
    if (!value) return false

    const { data, error } = await supabase.rpc('is_student_number_taken', { p_student_number: value })

    if (error) {
        console.warn('STUDENT NUMBER CHECK ERROR:', error)
        return null
    }

    return data === true
}

export function studentNumberTakenMessage(studentNumber) {
    return `Student ID ${studentNumber} is already registered. If this is your ID, log in or use "Forgot password". ` +
        "If you didn't register it, contact the Registrar's Office."
}

export async function isPhoneNumberTaken(phoneNumber) {
    const value = (phoneNumber || '').trim()
    if (!value) return false

    const { data, error } = await supabase.rpc('is_phone_number_taken', { p_phone_number: value })

    if (error) {
        console.warn('PHONE NUMBER CHECK ERROR:', error)
        return null
    }

    return data === true
}

export function phoneNumberTakenMessage(phoneNumber) {
    return `The phone number ${phoneNumber} is already registered to another account. ` +
        "Please use your own number, or contact the Registrar's Office if you think this is a mistake."
}

export function isDuplicateStudentNumberError(error) {
    return error?.code === '23505' || /student_number/i.test(error?.message || '')
}
