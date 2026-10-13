const RECORDING_DIR = '/workflow-narration/'

function scoreVoice(voice) {
    const name = `${voice.name} ${voice.voiceURI}`.toLowerCase()
    if (!/^en/i.test(voice.lang)) return -1
    let score = 0
    if (/natural|neural|online/.test(name)) score += 100
    if (/aria|jenny|ava|andrew|emma|brian|guy|michelle|sonia|ryan|natasha|william|libby/.test(name)) score += 30
    if (/google/.test(name)) score += 45
    if (/en[-_]us/i.test(voice.lang)) score += 8
    if (/en[-_](gb|au|ph)/i.test(voice.lang)) score += 5
    if (/samantha|daniel|karen|moira|serena/.test(name)) score += 25
    if (/desktop|espeak|zira|david|mark/.test(name)) score -= 20
    return score
}

export function availableVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
    return window.speechSynthesis
        .getVoices()
        .filter((v) => scoreVoice(v) >= 0)
        .sort((a, b) => scoreVoice(b) - scoreVoice(a))
}

export const isNaturalVoice = (voice) => !!voice && /natural|neural|online|google/i.test(`${voice.name} ${voice.voiceURI}`)

export function whenVoicesReady(timeoutMs = 2500) {
    return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) return resolve([])
        const now = availableVoices()
        if (now.length) return resolve(now)
        const done = () => resolve(availableVoices())
        window.speechSynthesis.addEventListener?.('voiceschanged', done, { once: true })
        setTimeout(done, timeoutMs)
    })
}

export async function recordingsAvailable(files) {
    const list = files.filter(Boolean)
    if (!list.length) return false
    try {
        const results = await Promise.all(list.map((f) =>
            fetch(RECORDING_DIR + f, { method: 'HEAD', cache: 'no-store' })
                .then((r) => r.ok && /audio|mpeg|octet-stream/i.test(r.headers.get('content-type') || ''))
                .catch(() => false)))
        return results.every(Boolean)
    } catch {
        return false
    }
}

const sentencesOf = (text) => (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]).map((s) => s.trim()).filter(Boolean)

export function createNarrator() {
    let mode = 'voice'
    let voice = null
    let audio = null
    let session = 0

    const stop = () => {
        session += 1
        if ('speechSynthesis' in window) window.speechSynthesis.cancel()
        if (audio) {
            audio.pause()
            audio = null
        }
    }

    const speakWithVoice = (text, mySession) => new Promise((resolve) => {
        if (!('speechSynthesis' in window)) return resolve()
        const synth = window.speechSynthesis
        const parts = sentencesOf(text)
        let i = 0
        const next = () => {
            if (mySession !== session) return resolve()
            if (i >= parts.length) return resolve()
            const u = new SpeechSynthesisUtterance(parts[i++])
            if (voice) {
                u.voice = voice
                u.lang = voice.lang
            } else {
                u.lang = 'en-US'
            }
            u.rate = isNaturalVoice(voice) ? 0.98 : 0.92
            u.pitch = 1
            u.volume = 1
            let finished = false
            const after = () => {
                if (finished) return
                finished = true
                setTimeout(next, i < parts.length ? 380 : 0)
            }
            u.onend = after
            u.onerror = after
            synth.speak(u)
            setTimeout(after, 2000 + parts[i - 1].length * 95)
        }
        next()
    })

    const playRecording = (file, mySession) => new Promise((resolve) => {
        const el = new Audio(RECORDING_DIR + file)
        audio = el
        el.onended = () => resolve()
        el.onerror = () => resolve()
        el.play().catch(() => resolve())
        const check = setInterval(() => {
            if (mySession !== session) {
                clearInterval(check)
                el.pause()
                resolve()
            }
        }, 200)
        el.addEventListener('ended', () => clearInterval(check))
    })

    return {
        setVoice(v) { voice = v },
        setMode(m) { mode = m },
        get mode() { return mode },
        speak(shot) {
            stop()
            const mySession = session
            if (!shot.narration) return Promise.resolve()
            if (mode === 'recording' && shot.audio) return playRecording(shot.audio, mySession)
            return speakWithVoice(shot.spoken || shot.narration, mySession)
        },
        stop,
    }
}
