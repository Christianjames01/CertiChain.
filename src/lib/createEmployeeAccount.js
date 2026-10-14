import { createClient, FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { getCaptchaToken } from './captcha'
import { supabase } from './supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export async function createEmployeeAccount(fields) {
    const { data, error } = await supabase.functions.invoke('create-employee-account', { body: fields })

    if (!error && data?.user) return data.user

    if (error instanceof FunctionsHttpError && error.context?.status !== 404) {
        let message = error.message
        let details
        try {
            const body = await error.context.json()
            message = body?.error || message
            details = body?.details
        } catch (err) {
            void err
        }
        const thrown = new Error(message)
        if (details) thrown.details = details
        throw thrown
    }

    if (error instanceof FunctionsHttpError || error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
        return createBySignUp(fields)
    }

    throw new Error(error?.message || 'The account could not be created.')
}

async function createBySignUp({
    email,
    password,
    firstName,
    lastName,
    employeeNumber,
    positionTitle,
    assignedCollegeId,
    displayName,
    phoneNumber,
}) {
    const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await tempClient.auth.signUp({
        email,
        password,
        options: {
            captchaToken: await getCaptchaToken(),
            data: {
                role: 'employee',
                first_name: firstName,
                last_name: lastName,
            },
        },
    })

    if (error) {
        throw new Error(error.message)
    }

    if (!data.user) {
        throw new Error(
            'Account created, but no user was returned. Email confirmation may be required before the profile exists.'
        )
    }

    const { error: employeeError } = await supabase
        .from('employees')
        .insert({
            user_id: data.user.id,
            employee_number: employeeNumber,
            position_title: positionTitle,
            assigned_college_id: assignedCollegeId || null,
            display_name: displayName || null,
            status: 'active',
        })

    if (employeeError) {
        const thrown = new Error(
            `Account created (${email}), but the employee profile could not be saved: ${employeeError.message}`
        )
        thrown.details = employeeError.details
        throw thrown
    }

    await supabase
        .from('profiles')
        .update({ must_change_password: true, phone_number: phoneNumber || null })
        .eq('user_id', data.user.id)

    return data.user
}
