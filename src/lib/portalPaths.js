export function adminPath(path = '') {
    const inHeadPortal = typeof window !== 'undefined' && window.location.pathname.startsWith('/head')
    return `${inHeadPortal ? '/head' : '/admin'}${path}`
}
