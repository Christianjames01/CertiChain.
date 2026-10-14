export const MOVABLE_STATUSES = ['pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified']

export function averageLoad(counts) {
    return counts.length ? counts.reduce((sum, n) => sum + n, 0) / counts.length : 0
}

export function isOverloaded(count, average, employeeCount) {
    return employeeCount > 1 && count - average >= 2 && count > average * 1.5
}

export function suggestRebalance(employees, requests, canTake = () => true) {
    if (employees.length < 2) return []

    const load = Object.fromEntries(employees.map((e) => [e.employee_id, 0]))
    const movable = Object.fromEntries(employees.map((e) => [e.employee_id, []]))
    const nameOf = Object.fromEntries(employees.map((e) => [e.employee_id, e.name]))

    for (const r of requests) {
        if (!(r.assigned_employee_id in load)) continue
        load[r.assigned_employee_id] += 1
        if (MOVABLE_STATUSES.includes(r.status)) movable[r.assigned_employee_id].push(r)
    }

    for (const list of Object.values(movable)) {
        list.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at))
    }

    const moves = []
    const ids = Object.keys(load)

    for (let guard = 0; guard < 500; guard += 1) {
        let move = null

        const donors = ids.filter((id) => movable[id].length > 0).sort((a, b) => load[b] - load[a])
        for (const from of donors) {
            for (const request of movable[from]) {
                const to = ids
                    .filter((id) => id !== from && canTake(id, request))
                    .sort((a, b) => load[a] - load[b])[0]
                if (to && load[from] - load[to] > 1) {
                    move = { from, to, request }
                    break
                }
            }
            if (move) break
        }

        if (!move) break

        movable[move.from] = movable[move.from].filter((r) => r !== move.request)
        load[move.from] -= 1
        load[move.to] += 1
        moves.push({ request: move.request, fromId: move.from, fromName: nameOf[move.from], toId: move.to, toName: nameOf[move.to] })
    }

    return moves
}
