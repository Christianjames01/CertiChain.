export const narrationSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

const PREF_KEY = (name) => `certichain_demo_sound:${name}`

export function readSoundPref(name, fallback = false) {
    try {
        const v = localStorage.getItem(PREF_KEY(name))
        return v === null ? fallback : v === '1'
    } catch {
        return fallback
    }
}

export function writeSoundPref(name, on) {
    try { localStorage.setItem(PREF_KEY(name), on ? '1' : '0') } catch {  }
}

let cachedVoice = null
function pickVoice() {
    if (cachedVoice) return cachedVoice
    const voices = window.speechSynthesis.getVoices()
    const english = voices.filter((v) => /^en/i.test(v.lang))
    cachedVoice =
        english.find((v) => /en[-_]PH/i.test(v.lang)) ||
        english.find((v) => /en[-_]US/i.test(v.lang) && /google|natural|online/i.test(v.name)) ||
        english.find((v) => /en[-_]US/i.test(v.lang)) ||
        english[0] ||
        null
    return cachedVoice
}

if (narrationSupported()) {
    window.speechSynthesis.addEventListener?.('voiceschanged', () => { cachedVoice = null })
}

function forSpeech(text) {
    return String(text)
        .replace(/₱\s?(\d[\d,.]*)/g, '$1 pesos')
        .replace(/\bREQ-0*(\d+)/g, 'request $1')
        .replace(/\bQ-0*(\d+)/g, 'number $1')
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/→|›|▶/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

let saidLines = new Set()
let currentOwner = null

export function say(text, { interrupt = false, force = false, owner = null } = {}) {
    if (!narrationSupported() || !text) return
    const line = forSpeech(text)
    if (!line) return
    if (saidLines.has(line) && !force) return

    const synth = window.speechSynthesis
    if (interrupt) {
        synth.cancel()
        saidLines = new Set()
    }
    saidLines.add(line)
    currentOwner = owner

    const u = new SpeechSynthesisUtterance(line)
    const voice = pickVoice()
    if (voice) u.voice = voice
    u.lang = voice?.lang || 'en-US'
    u.rate = 1
    u.pitch = 1
    synth.speak(u)
}

export function stopSpeaking(owner) {
    if (owner !== undefined && owner !== currentOwner) return
    currentOwner = null
    saidLines = new Set()
    if (narrationSupported()) window.speechSynthesis.cancel()
}

export function speaking() {
    return narrationSupported() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)
}
