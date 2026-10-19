import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame, Mark } from './reel/Scenes'
import { DURATION, SCENES } from './reel/timeline'
import { createReelSound } from './reel/reelSound'
import { createReelVoice } from './reel/reelVoice'
import './SystemWorkflow.css'

const W = 1920
const H = 1080

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function SystemWorkflow() {
    const [t, setT] = useState(0)
    const [playing, setPlaying] = useState(false)
    const [started, setStarted] = useState(false)
    const [scale, setScale] = useState(1)
    const [voiceOn, setVoiceOn] = useState(true)
    const [musicOn, setMusicOn] = useState(true)
    const [sfxOn, setSfxOn] = useState(true)
    const [chrome, setChrome] = useState(true)
    const [usesFile, setUsesFile] = useState(false)

    const tRef = useRef(0)
    const clock = useRef({ base: 0, at: 0 })
    const raf = useRef(0)
    const sound = useRef(null)
    const voice = useRef(null)
    const hideTimer = useRef(0)

    useEffect(() => {
        document.title = 'System Workflow · CertiChain'
        sound.current = createReelSound()
        voice.current = createReelVoice()
        voice.current.ready.then(() => setUsesFile(Boolean(voice.current?.usesFile)))
        const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H))
        fit()
        window.addEventListener('resize', fit)
        return () => {
            window.removeEventListener('resize', fit)
            cancelAnimationFrame(raf.current)
            sound.current?.stop()
            voice.current?.dispose()
        }
    }, [])

    const loop = useCallback(function step() {
        const now = performance.now()
        const next = Math.min(DURATION, clock.current.base + (now - clock.current.at) / 1000)
        tRef.current = next
        setT(next)
        voice.current?.tick(next)
        if (next >= DURATION) {
            setPlaying(false)
            sound.current?.stop()
            voice.current?.pause()
            setChrome(true)
            return
        }
        raf.current = requestAnimationFrame(step)
    }, [])

    const playFrom = useCallback((from) => {
        cancelAnimationFrame(raf.current)
        const start = from >= DURATION - 0.05 ? 0 : from
        clock.current = { base: start, at: performance.now() }
        tRef.current = start
        setT(start)
        sound.current?.setMusic(musicOn)
        sound.current?.setSfx(sfxOn)
        sound.current?.start(start)
        voice.current?.pause()
        voice.current?.play(start)
        setPlaying(true)
        raf.current = requestAnimationFrame(loop)
    }, [loop, musicOn, sfxOn])

    const pause = useCallback(() => {
        cancelAnimationFrame(raf.current)
        sound.current?.stop()
        voice.current?.pause()
        setPlaying(false)
        setChrome(true)
    }, [])

    const toggle = useCallback(() => {
        if (!started) {
            setStarted(true)
            playFrom(0)
            return
        }
        if (playing) pause()
        else playFrom(tRef.current)
    }, [started, playing, pause, playFrom])

    const seek = (to) => {
        const next = Math.max(0, Math.min(DURATION, to))
        if (playing) playFrom(next)
        else {
            tRef.current = next
            setT(next)
        }
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
        else document.exitFullscreen?.()
    }

    useEffect(() => {
        const onKey = (e) => {
            if (e.code === 'Space') { e.preventDefault(); toggle() }
            else if (e.key === 'ArrowRight') seek(tRef.current + 5)
            else if (e.key === 'ArrowLeft') seek(tRef.current - 5)
            else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    const wake = () => {
        setChrome(true)
        clearTimeout(hideTimer.current)
        hideTimer.current = setTimeout(() => { if (tRef.current < DURATION) setChrome(false) }, 2200)
    }

    const toggleVoice = () => {
        const next = !voiceOn
        setVoiceOn(next)
        voice.current?.setEnabled(next)
        if (next && playing) voice.current?.play(tRef.current)
    }
    const toggleMusic = () => {
        const next = !musicOn
        setMusicOn(next)
        sound.current?.setMusic(next)
    }
    const toggleSfx = () => {
        const next = !sfxOn
        setSfxOn(next)
        sound.current?.setSfx(next)
    }

    const ended = started && !playing && t >= DURATION - 0.05
    const current = SCENES.find((s) => t >= s.start && t < s.end) || SCENES[SCENES.length - 1]

    return (
        <div className={`wr-root${chrome || !playing ? ' show-chrome' : ''}`} onMouseMove={wake} onClick={() => started && wake()}>
            <div className="wr-stage" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}>
                <Frame t={t} />
            </div>

            {!started && (
                <div className="wr-start">
                    <div className="wr-start-card">
                        <Mark size={92} light />
                        <span className="wr-start-eyebrow">CertiChain · System Workflow</span>
                        <h1>The 1-minute reel</h1>
                        <p>From a student&apos;s request to a credential sealed on the Internet Computer blockchain, delivered, and verified by anyone.</p>
                        <button type="button" className="wr-start-btn" onClick={toggle}>▶ Play with sound</button>
                        <small>
                            {usesFile ? 'Recorded voice-over' : 'Narrated by your browser voice'} · music and sound effects · 1920×1080
                            <br />
                            <kbd>Space</kbd> play/pause · <kbd>←</kbd> <kbd>→</kbd> seek · <kbd>F</kbd> full screen
                        </small>
                    </div>
                </div>
            )}

            {started && (
                <div className="wr-controls" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="wr-ctl-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
                        {ended ? '↻' : playing ? '❚❚' : '▶'}
                    </button>
                    <span className="wr-ctl-time">{fmt(t)} / {fmt(DURATION)}</span>
                    <div
                        className="wr-scrub"
                        onClick={(e) => {
                            const r = e.currentTarget.getBoundingClientRect()
                            seek(((e.clientX - r.left) / r.width) * DURATION)
                        }}
                    >
                        <div className="wr-scrub-fill" style={{ width: `${(t / DURATION) * 100}%` }} />
                        {SCENES.map((s) => (
                            <span key={s.id} className={`wr-scrub-mark${current.id === s.id ? ' is-on' : ''}`} style={{ left: `${(s.start / DURATION) * 100}%` }} title={s.chapter}>
                                <i>{s.chapter}</i>
                            </span>
                        ))}
                    </div>
                    <button type="button" className={voiceOn ? 'is-on' : ''} onClick={toggleVoice}>Voice</button>
                    <button type="button" className={musicOn ? 'is-on' : ''} onClick={toggleMusic}>Music</button>
                    <button type="button" className={sfxOn ? 'is-on' : ''} onClick={toggleSfx}>SFX</button>
                    <button type="button" onClick={toggleFullscreen} aria-label="Full screen">⛶</button>
                    <Link to="/" className="wr-ctl-exit">Exit</Link>
                </div>
            )}
        </div>
    )
}

export default SystemWorkflow
