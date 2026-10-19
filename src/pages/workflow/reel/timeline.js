export const DURATION = 60
export const BPM = 120
export const BEAT = 60 / BPM

export const SCENES = [
    { id: 'hook', start: 0, end: 6, chapter: 'The problem' },
    { id: 'brand', start: 6, end: 10, chapter: 'CertiChain' },
    { id: 'student', start: 10, end: 19, chapter: 'Request' },
    { id: 'registrar', start: 19, end: 27.4, chapter: 'Registrar' },
    { id: 'chain', start: 27.4, end: 38, chapter: 'Blockchain' },
    { id: 'delivery', start: 38, end: 45, chapter: 'Delivery' },
    { id: 'verify', start: 45, end: 54, chapter: 'Verify' },
    { id: 'outro', start: 54, end: 60, chapter: 'Verified' },
]

export const CUTS = SCENES.slice(1).map((s) => s.start)

export const VOICE = [
    { at: 0.6, end: 5.4, text: 'Every year, thousands of students line up for a single piece of paper.' },
    { at: 6.4, end: 8.4, text: 'CertiChain changes that.' },
    { at: 10.3, end: 17.8, text: 'Request any document from your phone. Upload your requirements, and your official receipt. Done.' },
    { at: 19.3, end: 26.6, text: 'The Registrar reviews it, processes it, and generates the credential. Signed. Numbered. Ready.' },
    { at: 27.8, end: 37.4, text: 'Then, it is sealed. A SHA-256 fingerprint and an encrypted copy are written to the Internet Computer blockchain. Permanent. Tamper-proof.' },
    { at: 38.3, end: 44.4, text: 'Students claim it on schedule, or receive a sealed digital copy, straight to their email.' },
    { at: 45.3, end: 53.4, text: 'And anyone, anywhere, can verify it in seconds. Upload the file. Genuine, or not.' },
    { at: 54.5, end: 59, text: 'CertiChain. Your records, verified, and provable.' },
]

export const SFX = [
    ['tick', 1.2], ['tick', 2.0], ['tick', 2.8], ['tick', 3.6],
    ['paper', 2.7],
    ['whoosh', 5.7],
    ['shimmer', 6.2], ['impact', 7.6],
    ['whoosh', 9.7],
    ['type', 11.0], ['type', 11.7], ['type', 12.4],
    ['click', 13.0], ['pop', 13.25],
    ['swipe', 14.4], ['upload', 14.8], ['done', 15.9],
    ['swipe', 16.4], ['upload', 16.7], ['done', 17.6],
    ['impact', 18.2],
    ['whoosh', 18.8],
    ['tick', 20.2], ['tick', 21.0], ['tick', 22.4],
    ['type', 23.3], ['type', 23.6], ['type', 23.9],
    ['tick', 24.5], ['click', 25.0], ['pop', 25.3],
    ['stamp', 25.6], ['stamp', 26.1], ['stamp', 26.6],
    ['riser', 25.4],
    ['drop', 27.4],
    ['scan', 28.8], ['lock', 31.6],
    ['whoosh', 33.0], ['packet', 33.9], ['boom', 34.6],
    ['type', 35.5], ['type', 35.9], ['type', 36.3],
    ['stamp', 36.2], ['stamp', 36.9],
    ['whoosh', 37.8],
    ['pop', 39.2], ['mail', 40.4], ['pop', 41.1], ['whoosh', 43.4],
    ['whoosh', 44.8],
    ['drop-file', 46.4], ['scan', 47.0], ['chime', 48.4],
    ['drop-file', 50.4], ['buzz', 51.8],
    ['whoosh', 53.8],
    ['impact', 54.4], ['shimmer', 55.0], ['chime', 58.0],
]

export const sceneAt = (t) => SCENES.find((s) => t >= s.start && t < s.end) || SCENES[SCENES.length - 1]
