export const PH_MOBILE = /^09\d{9}$/

export function digitsOnly(value, max = 11) {
    return (value || '').replace(/\D/g, '').slice(0, max)
}

export function isValidPhMobile(value) {
    return PH_MOBILE.test(value || '')
}
