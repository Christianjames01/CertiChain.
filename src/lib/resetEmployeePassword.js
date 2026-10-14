import { supabase } from './supabase'

export async function resetEmployeePassword({ employeeUserId, tempPassword }) {
    const { error } = await supabase.rpc('reset_employee_password', {
        p_employee_user_id: employeeUserId,
        p_temp_password: tempPassword,
    })

    if (error) {
        if (/reset_employee_password/.test(error.message || '') && /schema cache|find the function/i.test(error.message || '')) {
            throw new Error('Password reset is not set up on the database yet (migration 20260925020000).')
        }
        throw new Error(error.message)
    }
}
