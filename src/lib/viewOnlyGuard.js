import { notifyError } from './notify'

export function blockedForReadOnlyViewer(role) {
    if (role !== 'superadmin') return false
    notifyError("Superadmin accounts can't make changes here. This portal is read-only for this account.")
    return true
}
