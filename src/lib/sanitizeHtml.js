import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'span', 'font', 'p', 'div', 'br', 'ul', 'ol', 'li']
const ALLOWED_ATTR = ['style', 'color', 'size', 'face']

export function sanitizeAnnouncementHtml(html) {
    return DOMPurify.sanitize(html || '', { ALLOWED_TAGS, ALLOWED_ATTR })
}
