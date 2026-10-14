export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '')

export const decimalOnly = (value) =>
    String(value ?? '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
