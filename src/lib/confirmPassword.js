import Swal from 'sweetalert2'
import { supabase } from './supabase'
import { getCaptchaToken } from './captcha'
import { notifyError } from './notify'
import '../components/PasswordInput.css'

const EYE_OPEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
const EYE_CLOSED = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6 0 9.5 5.5 9.5 7a9.9 9.9 0 0 1-2.6 3.4M6.2 6.6C3.6 8.3 2.5 10.9 2.5 12c0 1.5 3.5 7 9.5 7 1.3 0 2.5-.25 3.6-.7"/><path d="M9.5 9.6a3 3 0 0 0 4.2 4.2"/></svg>'

function addEyeButton(popup) {
    const input = popup.querySelector('input.swal2-input[type="password"]')
    if (!input || input.parentElement.classList.contains('pw-field')) return
    const wrap = document.createElement('div')
    wrap.className = 'pw-field is-swal'
    input.parentNode.insertBefore(wrap, input)
    wrap.appendChild(input)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'password-toggle'
    button.tabIndex = -1
    const sync = () => {
        const shown = input.type === 'text'
        button.innerHTML = shown ? EYE_CLOSED : EYE_OPEN
        button.setAttribute('aria-label', shown ? 'Hide password' : 'Show password')
    }
    button.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password'
        sync()
        input.focus()
    })
    sync()
    wrap.appendChild(button)
}

const missingFunction =(error) => error?.code === 'PGRST202'
    || (/verify_my_password/i.test(error?.message || '') && /not find|does not exist/i.test(error?.message || ''))

async function checkBySignIn(email, password, userId) {
    const captchaToken = await getCaptchaToken()
    if (captchaToken === null) return { ok: false, cancelled: true }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })
    if (error && !/invalid login credentials/i.test(error.message || '')) return { ok: false, message: error.message }
    return { ok: !error && data?.user?.id === userId }
}

export async function confirmWithPassword({ title = 'Confirm with your password', text } = {}) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
        notifyError('You are not logged in.')
        return false
    }

    const { value: password, isConfirmed } = await Swal.fire({
        icon: 'warning',
        title,
        text: text || 'For security, enter your account password to continue.',
        input: 'password',
        inputPlaceholder: 'Your password',
        inputAttributes: { autocomplete: 'current-password', autocapitalize: 'off', autocorrect: 'off' },
        showCancelButton: true,
        confirmButtonText: 'Confirm',
        confirmButtonColor: '#123B78',
        inputValidator: (value) => (!value ? 'Please enter your password.' : undefined),
        didOpen: addEyeButton,
    })

    if (!isConfirmed || !password) return false

    let result
    const { data, error } = await supabase.rpc('verify_my_password', { p_password: password })
    if (error && missingFunction(error)) {
        result = await checkBySignIn(user.email, password, user.id)
    } else if (error) {
        result = { ok: false, message: error.message }
    } else {
        result = { ok: data === true }
    }

    if (result.cancelled) return false
    if (!result.ok) {
        notifyError(
            result.message
                ? `Your password could not be checked: ${result.message}`
                : 'Incorrect password. The change was not made.',
            'Not confirmed'
        )
        return false
    }

    return true
}
