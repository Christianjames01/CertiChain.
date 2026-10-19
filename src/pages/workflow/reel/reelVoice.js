import { VOICE } from './timeline'

const clipUrl = (i) => `/reel/vo-${i + 1}.mp3`

const score = (v) => {
    if (!/^en/i.test(v.lang)) return -1
    const name = `${v.name} ${v.voiceURI}`
    let s = 0
    if (/natural|neural|online/i.test(name)) s += 100
    if (/guy|andrew|brian|christopher|eric|davis|ryan|william|david|mark/i.test(name)) s += 30
    if (/google/i.test(name)) s += 20
    if (/en[-_](us|gb)/i.test(v.lang)) s += 5
    return s
}

const isAudio = (r) => r.ok && /audio|mpeg|octet/i.test(r.headers.get('content-type') || '')

export function createReelVoice() {
    let clips = null
    let enabled = true
    let started = new Set()

    const ready = Promise.all(VOICE.map((_, i) => fetch(clipUrl(i), { method: 'HEAD' }).then(isAudio).catch(() => false)))
        .then((found) => {
            if (found.every(Boolean)) {
                clips = VOICE.map((_, i) => {
                    const a = new Audio(clipUrl(i))
                    a.preload = 'auto'
                    return a
                })
            }
        })

    const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
    const pickVoice = () => {
        const list = synth ? synth.getVoices().filter((v) => score(v) >= 0) : []
        list.sort((a, b) => score(b) - score(a))
        return list[0] || null
    }

    const speak = (text) => {
        if (!synth) return
        const u = new SpeechSynthesisUtterance(text)
        const v = pickVoice()
        if (v) {
            u.voice = v
            u.lang = v.lang
        }
        u.rate = v && /natural|neural|online/i.test(v.name) ? 1.08 : 1.12
        u.pitch = 0.95
        synth.speak(u)
    }

    const stopAll = () => {
        clips?.forEach((a) => a.pause())
        synth?.cancel()
    }

    return {
        ready,
        get usesFile() {
            return Boolean(clips)
        },
        play(t) {
            stopAll()
            started = new Set()
            if (!enabled) return
            VOICE.forEach((line, i) => {
                if (t >= line.end) started.add(i)
                else if (t > line.at + 0.3) {
                    started.add(i)
                    if (clips) {
                        clips[i].currentTime = t - line.at
                        clips[i].play().catch(() => {})
                    }
                }
            })
        },
        tick(t) {
            if (!enabled) return
            VOICE.forEach((line, i) => {
                if (started.has(i) || t < line.at || t >= line.end) return
                started.add(i)
                if (clips) {
                    clips[i].currentTime = 0
                    clips[i].play().catch(() => {})
                } else {
                    synth?.cancel()
                    speak(line.text)
                }
            })
        },
        pause: stopAll,
        setEnabled(on) {
            enabled = on
            if (!on) stopAll()
        },
        dispose() {
            stopAll()
            clips = null
        },
    }
}
