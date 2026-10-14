export const CLAIM_COUNTER_SUGGESTIONS = [
    'Registrar Window 1',
    'Registrar Window 2',
    'Registrar Window 3',
    'Releasing Counter',
]

export async function saveWithClaimCounter(payload, run) {
    const result = await run(payload)

    if (result.error && /claiming_counter/.test(result.error.message || '')) {
        console.warn('claiming_counter column missing; saving schedule without it.')
        const rest = { ...payload }
        delete rest.claiming_counter
        return run(rest)
    }

    return result
}
