import { BEAT, DURATION, SFX, VOICE } from './timeline'

const CHORDS = [
    { root: 110, notes: [220, 261.63, 329.63] },
    { root: 87.31, notes: [174.61, 220, 261.63] },
    { root: 130.81, notes: [261.63, 329.63, 392] },
    { root: 98, notes: [196, 246.94, 293.66] },
]

const section = (t) => {
    if (t < 6) return 'intro'
    if (t < 10) return 'lift'
    if (t < 25.4) return 'groove'
    if (t < 27.4) return 'build'
    if (t < 38) return 'drop'
    if (t < 45) return 'break'
    if (t < 54) return 'groove'
    return 'outro'
}

export function createReelSound() {
    const Ctx = window.AudioContext || window.webkitAudioContext
    let ctx = null
    let musicBus = null
    let sfxBus = null
    let musicOn = true
    let sfxOn = true
    let noise = null

    const env = (g, at, peak, attack, release) => {
        g.gain.setValueAtTime(0.0001, at)
        g.gain.linearRampToValueAtTime(peak, at + attack)
        g.gain.exponentialRampToValueAtTime(0.0001, at + attack + release)
    }

    const tone = (bus, at, freq, { type = 'sine', peak = 0.2, attack = 0.005, release = 0.3, to = null, filter = null } = {}) => {
        const o = ctx.createOscillator()
        o.type = type
        o.frequency.setValueAtTime(freq, at)
        if (to) o.frequency.exponentialRampToValueAtTime(to, at + attack + release)
        const g = ctx.createGain()
        env(g, at, peak, attack, release)
        let node = o
        if (filter) {
            const f = ctx.createBiquadFilter()
            f.type = filter.type || 'lowpass'
            f.frequency.setValueAtTime(filter.from, at)
            if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, at + attack + release)
            f.Q.value = filter.q || 0.8
            node.connect(f)
            node = f
        }
        node.connect(g).connect(bus)
        o.start(at)
        o.stop(at + attack + release + 0.05)
    }

    const hiss = (bus, at, dur, { peak = 0.15, type = 'bandpass', from = 800, to = 6000, q = 0.9, attack = 0.01 } = {}) => {
        const s = ctx.createBufferSource()
        s.buffer = noise
        const f = ctx.createBiquadFilter()
        f.type = type
        f.Q.value = q
        f.frequency.setValueAtTime(from, at)
        f.frequency.exponentialRampToValueAtTime(to, at + dur)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.linearRampToValueAtTime(peak, at + Math.max(attack, 0.005))
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
        s.connect(f).connect(g).connect(bus)
        s.start(at, Math.random() * 1.5)
        s.stop(at + dur + 0.05)
    }

    const kick = (at, big = false) => tone(musicBus, at, big ? 170 : 150, { peak: big ? 1 : 0.85, attack: 0.003, release: big ? 0.45 : 0.32, to: 40 })
    const hat = (at, level = 0.06) => hiss(musicBus, at, 0.05, { peak: level, type: 'highpass', from: 8000, to: 9000, q: 0.5, attack: 0.001 })
    const clap = (at) => hiss(musicBus, at, 0.18, { peak: 0.22, type: 'bandpass', from: 1500, to: 1200, q: 1.2, attack: 0.002 })
    const bass = (at, f, big = false) => tone(musicBus, at, f, { type: 'sawtooth', peak: big ? 0.22 : 0.15, attack: 0.01, release: BEAT * 0.9, filter: { from: big ? 1400 : 900, to: 160 } })
    const sub = (at, f) => tone(musicBus, at, f / 2, { peak: 0.28, attack: 0.02, release: BEAT * 1.8 })
    const pluck = (at, f, level = 0.07) => tone(musicBus, at, f * 2, { type: 'triangle', peak: level, attack: 0.004, release: 0.28, filter: { from: 4000, to: 900 } })
    const pad = (at, chord, dur, level = 0.05) => {
        for (const f of chord.notes) {
            for (const det of [-4, 4]) {
                const o = ctx.createOscillator()
                o.type = 'sawtooth'
                o.frequency.value = f
                o.detune.value = det
                const lp = ctx.createBiquadFilter()
                lp.type = 'lowpass'
                lp.frequency.value = 1100
                const g = ctx.createGain()
                g.gain.setValueAtTime(0.0001, at)
                g.gain.linearRampToValueAtTime(level, at + 0.6)
                g.gain.setValueAtTime(level, at + dur - 0.5)
                g.gain.linearRampToValueAtTime(0.0001, at + dur)
                o.connect(lp).connect(g).connect(musicBus)
                o.start(at)
                o.stop(at + dur + 0.05)
            }
        }
    }

    const scheduleMusic = (from, t0) => {
        const when = (t) => t0 + (t - from)
        const bar = BEAT * 4
        for (let b = 0; b * bar < DURATION; b++) {
            const barStart = b * bar
            if (barStart + bar < from) continue
            const chord = CHORDS[b % 4]
            const s = section(barStart)
            if (barStart >= from - bar) pad(when(Math.max(barStart, from)), chord, bar - Math.max(0, from - barStart), s === 'drop' ? 0.035 : s === 'outro' || s === 'intro' || s === 'break' ? 0.06 : 0.04)
            for (let i = 0; i < 8; i++) {
                const t = barStart + i * (BEAT / 2)
                if (t < from || t >= DURATION) continue
                const sec = section(t)
                const at = when(t)
                const onBeat = i % 2 === 0
                const beatNo = i / 2
                if (sec === 'intro') {
                    if (t > 0.4) pluck(at, chord.notes[i % 3], 0.045)
                } else if (sec === 'lift') {
                    if (onBeat) kick(at)
                    pluck(at, chord.notes[i % 3], 0.05)
                    if (!onBeat) hat(at, 0.04)
                } else if (sec === 'groove') {
                    if (onBeat) kick(at)
                    if (!onBeat) hat(at)
                    if (onBeat && (beatNo === 1 || beatNo === 3)) clap(at)
                    if (onBeat) bass(at, chord.root)
                    pluck(at, chord.notes[(i * 2) % 3], 0.05)
                } else if (sec === 'build') {
                    hat(at, 0.05)
                    clap(at)
                    if (onBeat) kick(at)
                } else if (sec === 'drop') {
                    if (onBeat) kick(at, true)
                    hat(at, onBeat ? 0.03 : 0.07)
                    if (onBeat && (beatNo === 1 || beatNo === 3)) clap(at)
                    bass(at, chord.root, true)
                    if (onBeat && beatNo === 0) sub(at, chord.root)
                    pluck(at, chord.notes[(i * 3) % 3] * (i % 4 === 3 ? 2 : 1), 0.06)
                } else if (sec === 'break') {
                    if (i === 0) kick(at)
                    pluck(at, chord.notes[i % 3], 0.04)
                } else if (sec === 'outro') {
                    if (t < 55 && onBeat) kick(at)
                }
            }
        }
        if (from < 27.4) hiss(musicBus, when(25.4), 2.0, { peak: 0.2, type: 'bandpass', from: 300, to: 9000, q: 1.4, attack: 1.8 })
    }

    const S = {
        tick: (at) => tone(sfxBus, at, 2400, { type: 'square', peak: 0.05, attack: 0.001, release: 0.03 }),
        paper: (at) => hiss(sfxBus, at, 0.35, { peak: 0.12, from: 2000, to: 900, q: 0.7 }),
        whoosh: (at) => hiss(sfxBus, at, 0.55, { peak: 0.26, from: 400, to: 5000, q: 1.1, attack: 0.25 }),
        swipe: (at) => hiss(sfxBus, at, 0.3, { peak: 0.16, from: 1200, to: 4200, q: 1.2, attack: 0.08 }),
        shimmer: (at) => [880, 1318.5, 1760, 2637].forEach((f, i) => tone(sfxBus, at + i * 0.06, f, { peak: 0.06, attack: 0.01, release: 0.9 })),
        impact: (at) => {
            tone(sfxBus, at, 120, { peak: 0.6, attack: 0.002, release: 0.6, to: 35 })
            hiss(sfxBus, at, 0.6, { peak: 0.18, type: 'lowpass', from: 3000, to: 200, q: 0.5, attack: 0.002 })
        },
        type: (at) => [0, 0.07, 0.15, 0.21].forEach((d) => tone(sfxBus, at + d, 1800 + Math.random() * 600, { type: 'square', peak: 0.025, attack: 0.001, release: 0.02 })),
        click: (at) => tone(sfxBus, at, 1200, { type: 'square', peak: 0.08, attack: 0.001, release: 0.04, to: 600 }),
        pop: (at) => tone(sfxBus, at, 500, { peak: 0.18, attack: 0.002, release: 0.14, to: 1100 }),
        upload: (at) => tone(sfxBus, at, 300, { type: 'triangle', peak: 0.1, attack: 0.05, release: 1.0, to: 1300 }),
        done: (at) => [783.99, 1174.66].forEach((f, i) => tone(sfxBus, at + i * 0.09, f, { type: 'triangle', peak: 0.12, attack: 0.004, release: 0.35 })),
        stamp: (at) => {
            tone(sfxBus, at, 90, { peak: 0.5, attack: 0.002, release: 0.22, to: 50 })
            hiss(sfxBus, at, 0.12, { peak: 0.14, type: 'lowpass', from: 2500, to: 400, attack: 0.001 })
        },
        drop: (at) => {
            tone(sfxBus, at, 60, { peak: 0.9, attack: 0.003, release: 1.2, to: 30 })
            hiss(sfxBus, at, 1.4, { peak: 0.2, type: 'lowpass', from: 5000, to: 120, attack: 0.003 })
        },
        scan: (at) => tone(sfxBus, at, 400, { type: 'sawtooth', peak: 0.05, attack: 0.1, release: 1.6, to: 2400, filter: { from: 1200, to: 4000, type: 'bandpass', q: 4 } }),
        lock: (at) => {
            tone(sfxBus, at, 1500, { type: 'square', peak: 0.07, attack: 0.001, release: 0.05 })
            tone(sfxBus, at + 0.08, 900, { type: 'square', peak: 0.08, attack: 0.001, release: 0.08 })
        },
        packet: (at) => tone(sfxBus, at, 600, { type: 'sine', peak: 0.12, attack: 0.02, release: 0.5, to: 1800 }),
        boom: (at) => {
            tone(sfxBus, at, 80, { peak: 1, attack: 0.002, release: 1.4, to: 28 })
            hiss(sfxBus, at, 1.2, { peak: 0.22, type: 'lowpass', from: 4000, to: 100, attack: 0.002 })
            ;[523.25, 659.25, 783.99].forEach((f) => tone(sfxBus, at + 0.05, f, { type: 'triangle', peak: 0.07, attack: 0.01, release: 1.2 }))
        },
        mail: (at) => [1046.5, 1318.5].forEach((f, i) => tone(sfxBus, at + i * 0.12, f, { peak: 0.12, attack: 0.005, release: 0.5 })),
        'drop-file': (at) => {
            hiss(sfxBus, at, 0.25, { peak: 0.14, from: 3000, to: 600, q: 0.8 })
            tone(sfxBus, at + 0.22, 220, { peak: 0.3, attack: 0.002, release: 0.18, to: 110 })
        },
        chime: (at) => [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => tone(sfxBus, at + i * 0.07, f, { type: 'triangle', peak: 0.11, attack: 0.005, release: 1.1 })),
        buzz: (at) => [0, 0.16].forEach((d) => tone(sfxBus, at + d, 140, { type: 'square', peak: 0.12, attack: 0.004, release: 0.12, filter: { from: 900, to: 500 } })),
    }

    const scheduleSfx = (from, t0) => {
        for (const [name, t] of SFX) {
            if (t < from - 0.01) continue
            S[name]?.(t0 + (t - from))
        }
    }

    const scheduleDucking = (from, t0) => {
        const g = musicBus.gain
        const base = musicOn ? 0.75 : 0
        const duck = musicOn ? 0.42 : 0
        g.cancelScheduledValues(t0)
        const inLine = VOICE.find((v) => from >= v.at && from < v.end)
        g.setValueAtTime(inLine ? duck : base, t0)
        for (const v of VOICE) {
            if (v.end < from) continue
            if (v.at > from) {
                g.setTargetAtTime(duck, t0 + (v.at - from) - 0.1, 0.08)
            }
            g.setTargetAtTime(base, t0 + (v.end - from), 0.25)
        }
        g.setTargetAtTime(0.0001, t0 + (DURATION - 1.2 - from), 0.4)
    }

    return {
        start(from = 0) {
            if (!Ctx) return
            this.stop()
            ctx = new Ctx()
            noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
            const d = noise.getChannelData(0)
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
            const master = ctx.createDynamicsCompressor()
            master.threshold.value = -14
            master.ratio.value = 4
            master.connect(ctx.destination)
            musicBus = ctx.createGain()
            sfxBus = ctx.createGain()
            sfxBus.gain.value = sfxOn ? 0.9 : 0
            musicBus.connect(master)
            sfxBus.connect(master)
            const t0 = ctx.currentTime + 0.06
            scheduleDucking(from, t0)
            scheduleMusic(from, t0)
            scheduleSfx(from, t0)
        },
        stop() {
            if (ctx) {
                const old = ctx
                ctx = null
                old.close().catch(() => {})
            }
        },
        setMusic(on) {
            musicOn = on
            if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.75 : 0, ctx.currentTime, 0.05)
        },
        setSfx(on) {
            sfxOn = on
            if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05)
        },
    }
}
