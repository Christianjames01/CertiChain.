import certichainLogo from '../../../assets/certichain-logo.png'
import hcdcLogo from '../../../assets/hcdc-logo.png'
import { BEAT, CUTS, SCENES } from './timeline'

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const seg = (t, a, b) => clamp((t - a) / (b - a))
const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
const outCubic = (x) => 1 - Math.pow(1 - x, 3)
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const outBack = (x) => {
    const c1 = 1.7
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
const lerp = (a, b, k) => a + (b - a) * k
const rand = (i) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
    return x - Math.floor(x)
}
const typed = (text, t, start, cps = 22) => text.slice(0, Math.max(0, Math.floor((t - start) * cps)))
const HEX = '0123456789abcdef'
const scramble = (target, p, seed = 3) =>
    [...target].map((ch, i) => (ch === 'x' && i === 1 ? ch : rand(i * 13 + seed + Math.floor(p * 40)) > p ? HEX[Math.floor(rand(i * 7 + seed + Math.floor(p * 60)) * 16)] : ch)).join('')

const FINGERPRINT = '0x3107b80b4630c607fdaf0c39958ce51322b24270ac2ec840f4a7f072649967cb'
const EDITED = '0x9d41c2e07a5f3b18e6d0947c2a1fb85e33c07d6a19e4b2f8c5d1a07e6b39f412'
const ENCRYPTED = '01 76 8d 2c 82 ff e7 fa ce 09 44 b4 24 b8 9d c2 77 e4 fd d4 01 45 ae bd 50 12 4d de 42 c1 df 0a bf a9 c5 19 22 b8 b6 bd 85 bc ac 20 9e 31 07 c4'

export function Mark({ size, p = 1, light = false }) {
    const ink = light ? '#FFFFFF' : '#0B2A5B'
    const blue = light ? '#8DBBFF' : '#2563EB'
    const gold = '#E6B54A'
    const dash = (k) => ({ strokeDasharray: 1, strokeDashoffset: 1 - clamp(k) })
    const step = (a) => outCubic(seg(p, a, a + 0.32))
    return (
        <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
            <rect x="4" y="8" width="36" height="30" rx="7" fill="none" stroke={ink} strokeWidth="5" pathLength="1" style={dash(step(0))} />
            <path d="M11 16.5H25M11 23H23M11 29.5H19" fill="none" stroke={blue} strokeWidth="3.6" strokeLinecap="round" pathLength="1" style={dash(step(0.2))} />
            <rect x="30" y="20" width="28" height="28" rx="9" fill="none" stroke={blue} strokeWidth="5" pathLength="1" style={dash(step(0.35))} />
            <g style={{ transformOrigin: '44px 50px', transform: `scaleY(${step(0.55)})` }}>
                <path d="M36.5 50.5 34.5 61 38.4 58.6 41.6 61 42.2 50.5ZM51.5 50.5 53.5 61 49.6 58.6 46.4 61 45.8 50.5Z" fill={blue} />
            </g>
            <path d="M38.4 34.6 42.4 38.6 49.8 30.8" fill="none" stroke={gold} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" style={dash(step(0.68))} />
        </svg>
    )
}

function Kinetic({ text, t, start, step = 0.035, className = '', style }) {
    return (
        <span className={`wr-kin ${className}`} style={style}>
            {[...text].map((ch, i) => {
                const k = outBack(seg(t, start + i * step, start + i * step + 0.5))
                return (
                    <span key={i} style={{ opacity: clamp(k * 1.5), transform: `translateY(${(1 - k) * 105}%) rotate(${(1 - k) * 7}deg)` }}>
                        {ch === ' ' ? ' ' : ch}
                    </span>
                )
            })}
        </span>
    )
}

function Stamp({ text, t, at, tone = 'blue', x, y, size = 64, rot = -6 }) {
    const k = seg(t, at, at + 0.28)
    if (t < at) return null
    const s = lerp(2.4, 1, outExpo(k))
    return (
        <div className={`wr-stamp is-${tone}`} style={{ left: x, top: y, fontSize: size, opacity: clamp(k * 3), transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${s})` }}>
            {text}
        </div>
    )
}

function Window({ x, y, w, h, url, children, style }) {
    return (
        <div className="wr-window" style={{ left: x, top: y, width: w, height: h, ...style }}>
            <div className="wr-window-bar">
                <span /><span /><span />
                <div className="wr-window-url">{url}</div>
            </div>
            <div className="wr-window-body">{children}</div>
        </div>
    )
}

function Pill({ tone, children, style }) {
    return <span className={`wr-pill is-${tone}`} style={style}>{children}</span>
}

function Check({ on, size = 26 }) {
    return (
        <span className={`wr-check${on ? ' is-on' : ''}`} style={{ width: size, height: size }}>
            <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62}><path d="M5 12.5 10 17.5 19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength="1" style={{ strokeDasharray: 1, strokeDashoffset: on ? 0 : 1, transition: 'none' }} /></svg>
        </span>
    )
}

function Cursor({ x, y, press = 0 }) {
    return (
        <div className="wr-cursor" style={{ left: x, top: y, transform: `scale(${1 - press * 0.18})` }}>
            <svg viewBox="0 0 24 24" width="38" height="38"><path d="M4 2.5 19.5 13l-6.6 1.3 3.6 7.1-3 1.5-3.6-7.2L4 20.5Z" fill="#fff" stroke="#0B1730" strokeWidth="1.4" strokeLinejoin="round" /></svg>
            {press > 0 && <span className="wr-cursor-ring" style={{ transform: `translate(-50%, -50%) scale(${1 + press * 1.6})`, opacity: 1 - press }} />}
        </div>
    )
}

function Background({ t }) {
    const scene = SCENES.find((s) => t >= s.start && t < s.end)
    const dark = scene?.id !== 'outro' || t < 54.2
    const pulse = Math.pow(1 - ((t % BEAT) / BEAT), 4) * (t > 6 && t < 54 ? 1 : 0.2)
    const drop = t >= 27.4 && t < 38
    return (
        <div className={`wr-bg${dark ? '' : ' is-light'}`}>
            <span className="wr-blob is-blue" style={{ transform: `translate(${Math.sin(t * 0.31) * 260}px, ${Math.cos(t * 0.27) * 160}px) scale(${1 + pulse * 0.05})` }} />
            <span className="wr-blob is-red" style={{ transform: `translate(${Math.cos(t * 0.23) * 300}px, ${Math.sin(t * 0.35) * 180}px)`, opacity: drop ? 0.25 : 0.45 }} />
            <span className="wr-blob is-gold" style={{ transform: `translate(${Math.sin(t * 0.41 + 2) * 220}px, ${Math.cos(t * 0.33 + 1) * 200}px)`, opacity: drop ? 0.7 : 0.35 }} />
            <div className="wr-grid" style={{ backgroundPosition: `${(t * 18) % 96}px ${(t * 40) % 96}px`, opacity: 0.22 + pulse * 0.12 }} />
            <div className="wr-noise" />
        </div>
    )
}

function SceneHook({ t }) {
    const l = t
    const out = seg(t, 5.3, 6)
    const people = 34
    return (
        <div className="wr-scene" style={{ opacity: 1 - out, filter: `blur(${out * 12}px)`, transform: `scale(${1 + out * 0.2})` }}>
            <div className="wr-queue" style={{ transform: `translateX(${-l * 70}px)` }}>
                {Array.from({ length: people }, (_, i) => {
                    const k = outBack(seg(l, 0.1 + i * 0.03, 0.6 + i * 0.03))
                    const bob = Math.sin(l * 3 + i) * 4
                    return (
                        <div key={i} className="wr-person" style={{ left: 120 + i * 92, opacity: clamp(k), transform: `translateY(${(1 - k) * 80 + bob}px)` }}>
                            <span className="wr-person-head" style={{ background: i % 7 === 3 ? '#E6B54A' : i % 5 === 1 ? '#C8102E' : '#8DBBFF' }} />
                            <span className="wr-person-body" />
                        </div>
                    )
                })}
            </div>
            <div className="wr-clock" style={{ opacity: seg(l, 0.6, 1.1) }}>
                <svg viewBox="0 0 100 100" width="150" height="150">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="6" />
                    <line x1="50" y1="50" x2="50" y2="18" stroke="#fff" strokeWidth="5" strokeLinecap="round" style={{ transformOrigin: '50px 50px', transform: `rotate(${l * 240}deg)` }} />
                    <line x1="50" y1="50" x2="72" y2="50" stroke="#E6B54A" strokeWidth="5" strokeLinecap="round" style={{ transformOrigin: '50px 50px', transform: `rotate(${l * 20}deg)` }} />
                </svg>
            </div>
            <div className="wr-hook-title">
                <Kinetic text="Thousands of students." t={t} start={0.5} className="is-xl" />
                <div style={{ height: 18 }} />
                <Kinetic text="One piece of paper." t={t} start={2.5} className="is-xl is-gold" />
            </div>
            <div className="wr-paper" style={{ opacity: seg(l, 2.6, 2.9), transform: `translate(-50%, ${lerp(-420, 0, outBack(seg(l, 2.6, 3.4)))}px) rotate(${lerp(-24, 6, outCubic(seg(l, 2.6, 3.4)))}deg)` }}>
                <span />
                <span />
                <span />
                <span />
                <i>CERTIFIED TRUE COPY</i>
            </div>
        </div>
    )
}

function SceneBrand({ t }) {
    const l = t - 6
    const out = seg(t, 9.6, 10)
    const ring = seg(l, 1.4, 2.6)
    return (
        <div className="wr-scene wr-center" style={{ opacity: 1 - out, transform: `scale(${1 + out * 0.08})` }}>
            <span className="wr-ring" style={{ width: lerp(200, 1500, outExpo(ring)), height: lerp(200, 1500, outExpo(ring)), opacity: (1 - ring) * 0.8 }} />
            <span className="wr-ring is-gold" style={{ width: lerp(200, 1100, outExpo(seg(l, 1.6, 2.6))), height: lerp(200, 1100, outExpo(seg(l, 1.6, 2.6))), opacity: (1 - seg(l, 1.6, 2.6)) * 0.6 }} />
            <div style={{ transform: `scale(${lerp(0.6, 1, outBack(seg(l, 0, 0.8)))})` }}>
                <Mark size={300} p={seg(l, 0.1, 1.6)} light />
            </div>
            <div className="wr-brand-word">
                <Kinetic text="CertiChain" t={t} start={7.5} step={0.05} className="is-brand" />
            </div>
            <div className="wr-brand-sub" style={{ opacity: seg(l, 2.4, 2.9), transform: `translateY(${(1 - outCubic(seg(l, 2.4, 2.9))) * 20}px)` }}>
                HCDC Registrar Services · Request · Track · Verify
            </div>
        </div>
    )
}

function SceneStudent({ t }) {
    const l = t - 10
    const enter = outExpo(seg(l, 0, 0.9))
    const out = seg(t, 18.7, 19)
    const step = l < 4.4 ? 0 : l < 6.4 ? 1 : 2
    const screenShift = step === 0 ? 0 : step === 1 ? -seg(l, 4.4, 4.8) * 100 : -100 - seg(l, 6.4, 6.8) * 100
    const submitPress = seg(l, 3.0, 3.25) * (1 - seg(l, 3.25, 3.5))
    const reqProgress = outCubic(seg(l, 4.8, 5.9))
    const orProgress = outCubic(seg(l, 6.7, 7.6))
    const done = (i) => (i === 0 ? l > 3.3 : i === 1 ? l > 5.9 : l > 7.6)
    return (
        <div className="wr-scene" style={{ opacity: 1 - out }}>
            <div className="wr-chapter" style={{ opacity: seg(l, 0.2, 0.6) }}><b>01</b> The student</div>
            <div className="wr-phone" style={{ transform: `translate(${lerp(-500, 0, enter)}px, ${Math.sin(l * 1.2) * 6}px) rotate(${lerp(-12, -3, enter)}deg)` }}>
                <div className="wr-phone-notch" />
                <div className="wr-phone-screen">
                    <div className="wr-phone-top">
                        <img src={certichainLogo} alt="" />
                        <b>CertiChain</b>
                        <span>Student</span>
                    </div>
                    <div className="wr-phone-track" style={{ transform: `translateX(${screenShift}%)` }}>
                        <section className="wr-pscreen">
                            <h3>New Request</h3>
                            <p>Choose the document you need.</p>
                            {[['Document', 'Transcript of Records', 0.9], ['Copies', '1 copy', 1.6], ['Purpose', 'Employment', 2.2]].map(([k, v, at]) => (
                                <label key={k} className={l > at ? 'is-filled' : ''}>
                                    <span>{k}</span>
                                    <div>{typed(v, l, at, 30)}{l > at && l < at + 0.9 && <i className="wr-caret" />}</div>
                                </label>
                            ))}
                            <div className="wr-pfee"><span>Total</span><b>₱150.00</b></div>
                            <button type="button" className={l > 3.25 ? 'is-done' : ''} style={{ transform: `scale(${1 - submitPress * 0.06})` }}>
                                {l > 3.25 ? 'Submitted ✓' : 'Submit request'}
                            </button>
                            {l > 3.25 && <div className="wr-toast" style={{ opacity: seg(l, 3.25, 3.5), transform: `translateY(${(1 - outBack(seg(l, 3.25, 3.7))) * 30}px)` }}>REQ-000124 · Pending</div>}
                        </section>
                        <section className="wr-pscreen">
                            <h3>Upload Requirements</h3>
                            <p>Transcript of Records · REQ-000124</p>
                            <div className={`wr-pfile${reqProgress >= 1 ? ' is-done' : ''}`}>
                                <span className="wr-pfile-icon">ID</span>
                                <div><b>valid-id.jpg</b><small>{reqProgress >= 1 ? 'Uploaded ✓' : `${Math.round(reqProgress * 100)}%`}</small><i style={{ width: `${reqProgress * 100}%` }} /></div>
                            </div>
                            <div className={`wr-pfile${reqProgress >= 1 ? ' is-done' : ''}`}>
                                <span className="wr-pfile-icon">PDF</span>
                                <div><b>clearance.pdf</b><small>{reqProgress >= 1 ? 'Uploaded ✓' : `${Math.round(clamp(reqProgress * 1.2) * 100)}%`}</small><i style={{ width: `${clamp(reqProgress * 1.2) * 100}%` }} /></div>
                            </div>
                        </section>
                        <section className="wr-pscreen">
                            <h3>Upload Official Receipt</h3>
                            <p>Paid at the HCDC Finance Office</p>
                            <div className="wr-receipt" style={{ transform: `rotate(${lerp(8, -2, outBack(seg(l, 6.5, 7.1)))}deg)` }}>
                                <b>OFFICIAL RECEIPT</b>
                                <small>Holy Cross of Davao College</small>
                                <span>OR No. 0084213</span>
                                <em>₱150.00</em>
                            </div>
                            <div className={`wr-pfile${orProgress >= 1 ? ' is-done' : ''}`}>
                                <span className="wr-pfile-icon">OR</span>
                                <div><b>receipt.jpg</b><small>{orProgress >= 1 ? 'Receipt Uploaded ✓' : `${Math.round(orProgress * 100)}%`}</small><i style={{ width: `${orProgress * 100}%` }} /></div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
            <div className="wr-steps">
                {['Request a document', 'Upload requirements', 'Upload official receipt'].map((label, i) => {
                    const k = outCubic(seg(l, 0.5 + i * 0.25, 1.1 + i * 0.25))
                    return (
                        <div key={label} className={`wr-step${done(i) ? ' is-done' : ''}${step === i ? ' is-current' : ''}`} style={{ opacity: k, transform: `translateX(${(1 - k) * 80}px)` }}>
                            <Check on={done(i)} size={52} />
                            <div><small>Step {i + 1}</small><b>{label}</b></div>
                        </div>
                    )
                })}
                <Kinetic text="Done." t={t} start={18.2} className="is-xl is-gold wr-steps-done" />
            </div>
        </div>
    )
}

const STATUS = [
    ['Pending', 'amber', 0],
    ['Payment Verified', 'blue', 1.6],
    ['Processing', 'blue', 3.2],
    ['Ready for Claiming', 'green', 6.4],
]

function SceneRegistrar({ t }) {
    const l = t - 19
    const enter = outExpo(seg(l, 0, 0.9))
    const out = seg(t, 27.1, 27.4)
    const status = [...STATUS].reverse().find((s) => l >= s[2]) || STATUS[0]
    const genPress = seg(l, 6.0, 6.2) * (1 - seg(l, 6.2, 6.45))
    const generated = l > 6.25
    const cursor = l < 4.3 ? { x: lerp(1500, 860, inOut(seg(l, 0.6, 1.4))), y: lerp(900, 560, inOut(seg(l, 0.6, 1.4))) }
        : l < 5.4 ? { x: lerp(860, 990, inOut(seg(l, 4.3, 4.8))), y: lerp(560, 706, inOut(seg(l, 4.3, 4.8))) }
            : { x: lerp(990, 1030, inOut(seg(l, 5.4, 5.9))), y: lerp(706, 790, inOut(seg(l, 5.4, 5.9))) }
    const press = l > 5.95 && l < 6.5 ? seg(l, 5.95, 6.5) : l > 1.5 && l < 1.9 ? seg(l, 1.5, 1.9) : 0
    return (
        <div className="wr-scene" style={{ opacity: 1 - out }}>
            <div className="wr-chapter" style={{ opacity: seg(l, 0.2, 0.6) }}><b>02</b> The Registrar</div>
            <Window x={300} y={150} w={1320} h={780} url="certichain · Registrar · REQ-000124" style={{ transform: `translateY(${(1 - enter) * 160}px) scale(${lerp(0.9, 1, enter)})`, opacity: enter }}>
                <div className="wr-admin">
                    <aside>
                        <div className="wr-admin-brand"><img src={certichainLogo} alt="" /><b>CertiChain</b></div>
                        {['Dashboard', 'All Requests', 'Official Receipts', 'Request Handling', 'Claim Schedules', 'Credentials', 'Digital Certificates', 'Blockchain Records'].map((n, i) => (
                            <span key={n} className={i === 1 ? 'is-active' : ''}>{n}</span>
                        ))}
                    </aside>
                    <main>
                        <div className="wr-admin-head">
                            <div><small>Request</small><h3>REQ-000124 · Transcript of Records</h3><p>Juan Dela Cruz · BS Information Technology</p></div>
                            <Pill tone={status[1]} key={status[0]} style={{ animation: 'none', transform: `scale(${lerp(1.3, 1, outBack(seg(l, status[2], status[2] + 0.35)))})` }}>{status[0]}</Pill>
                        </div>
                        <div className="wr-admin-grid">
                            <div className="wr-admin-card">
                                <b>Review</b>
                                {[['Valid ID', 1.2], ['Clearance', 1.5], ['Official Receipt · ₱150.00', 1.8], ['Document prepared', 3.4]].map(([n, at]) => (
                                    <div key={n} className="wr-admin-row"><Check on={l > at} size={28} /><span>{n}</span></div>
                                ))}
                            </div>
                            <div className="wr-admin-card">
                                <b>Generate Digital Credential</b>
                                <label>Credential Number</label>
                                <div className="wr-admin-input">{typed('CERT-000124', l, 4.3, 12)}{l > 4.3 && l < 5.4 && <i className="wr-caret" />}</div>
                                <div className="wr-admin-choice"><Check on={l > 5.5} size={24} /><span>Email the digital copy (PDF) to the student</span></div>
                                <button type="button" className={generated ? 'is-done' : ''} style={{ transform: `scale(${1 - genPress * 0.06})` }}>
                                    {generated ? 'Credential generated ✓' : 'Generate Digital Credential'}
                                </button>
                            </div>
                        </div>
                        {generated && (
                            <div className="wr-admin-cred" style={{ opacity: seg(l, 6.3, 6.6), transform: `translateY(${(1 - outBack(seg(l, 6.3, 6.8))) * 40}px)` }}>
                                <b>Digital Credential</b>
                                <span className="wr-mono">CERT-000124</span>
                                <span>Signed by the Registrar</span>
                                <Pill tone="green">Valid</Pill>
                            </div>
                        )}
                    </main>
                </div>
            </Window>
            <Cursor x={cursor.x} y={cursor.y} press={press} />
            <Stamp text="SIGNED." t={t} at={25.6} x={460} y={980} size={72} rot={-5} />
            <Stamp text="NUMBERED." t={t} at={26.1} x={960} y={1000} size={72} rot={3} tone="gold" />
            <Stamp text="READY." t={t} at={26.6} x={1440} y={975} size={72} rot={-3} tone="green" />
        </div>
    )
}

function SceneChain({ t }) {
    const l = t - 27.4
    const out = seg(t, 37.7, 38)
    const flash = 1 - seg(l, 0, 0.35)
    const card = outExpo(seg(l, 0.1, 0.9))
    const hashP = seg(l, 1.6, 3.6)
    const lockP = outBack(seg(l, 4.2, 4.7))
    const chainIn = outExpo(seg(l, 5.4, 6.4))
    const packet = inOut(seg(l, 6.4, 7.2))
    const recorded = l > 7.2
    const shake = recorded ? Math.max(0, 1 - (l - 7.2) / 0.5) * 14 : 0
    const blocks = ['#121', '#122', '#123', '#124']
    return (
        <div className="wr-scene" style={{ opacity: 1 - out, transform: `translate(${Math.sin(l * 80) * shake}px, ${Math.cos(l * 70) * shake}px)` }}>
            <div className="wr-flash" style={{ opacity: flash * 0.7 }} />
            <div className="wr-chapter" style={{ opacity: seg(l, 0.3, 0.7) }}><b>03</b> Sealed on the blockchain</div>

            <div className="wr-cred" style={{ transform: `translate(${lerp(-300, 0, card)}px, ${lerp(80, 0, card)}px) rotate(${lerp(-10, -2, card)}deg) scale(${lerp(0.8, 1, card)})`, opacity: card }}>
                <div className="wr-cred-top"><img src={hcdcLogo} alt="" /><div><b>HOLY CROSS OF DAVAO COLLEGE</b><small>Office of the Registrar</small></div></div>
                <h4>Transcript of Records</h4>
                <p>Juan Dela Cruz</p>
                <div className="wr-cred-lines"><span /><span /><span /><span /></div>
                <div className="wr-cred-foot"><span className="wr-mono">CERT-000124</span><Pill tone="green">Signed</Pill></div>
            </div>

            <div className="wr-beam" style={{ opacity: seg(l, 1.3, 1.6) * (1 - seg(l, 3.8, 4.2)), transform: `scaleX(${outExpo(seg(l, 1.3, 1.9))})` }} />

            <div className="wr-hash" style={{ opacity: seg(l, 1.5, 1.9) }}>
                <small>SHA-256 fingerprint</small>
                <div className="wr-mono wr-hash-value">{hashP >= 1 ? FINGERPRINT : scramble(FINGERPRINT, hashP)}</div>
                <div className="wr-hash-bar"><i style={{ width: `${hashP * 100}%` }} /></div>
            </div>

            <div className="wr-aes" style={{ opacity: seg(l, 4.0, 4.3), transform: `scale(${lerp(0.7, 1, lockP)})` }}>
                <div className="wr-lock">
                    <svg viewBox="0 0 48 48" width="70" height="70"><rect x="9" y="21" width="30" height="21" rx="5" fill="#E6B54A" /><path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#E6B54A" strokeWidth="5" style={{ transform: `translateY(${(1 - lockP) * -6}px)` }} /></svg>
                </div>
                <div>
                    <small>AES-256 encrypted copy</small>
                    <div className="wr-mono wr-aes-bytes">{ENCRYPTED}</div>
                </div>
            </div>

            <div className="wr-chain" style={{ opacity: chainIn, transform: `translateX(${(1 - chainIn) * 700}px)` }}>
                {blocks.map((b, i) => {
                    const isNew = i === blocks.length - 1
                    const lit = isNew && recorded
                    return (
                        <div key={b} className={`wr-block${lit ? ' is-lit' : ''}${isNew ? ' is-new' : ''}`} style={isNew ? { transform: `scale(${recorded ? lerp(1.25, 1, outBack(seg(l, 7.2, 7.6))) : 1})` } : undefined}>
                            <small>RECORD</small>
                            <b>{b}</b>
                            <i /><i /><i />
                            {i < blocks.length - 1 && <span className="wr-link" />}
                        </div>
                    )
                })}
                <div className="wr-packet" style={{ opacity: packet > 0 && packet < 1 ? 1 : 0, left: `${lerp(-30, 76, packet)}%` }} />
                <div className="wr-canister">
                    <span className="wr-icp-dot" />
                    Internet Computer · canister trzz4-6aaaa-aaaan-q6vhq-cai
                </div>
            </div>

            <Stamp text="RECORDED" t={t} at={34.6} x={1420} y={300} size={96} rot={-8} tone="green" />

            <div className="wr-term" style={{ opacity: seg(l, 7.9, 8.2) }}>
                <span className="wr-mono">&gt; latestLogs(1)</span>
                <span className="wr-mono">{typed('RECORDED  #124  CERT-000124 · Transcript of Records  2026-10-19 14:02:11 PHT', l, 8.1, 60)}</span>
            </div>
            <Kinetic text="Permanent." t={t} start={36.2} className="is-lg wr-chain-k1" />
            <Kinetic text="Tamper-proof." t={t} start={36.9} className="is-lg is-gold wr-chain-k2" />
        </div>
    )
}

function SceneDelivery({ t }) {
    const l = t - 38
    const out = seg(t, 44.7, 45)
    const cal = outBack(seg(l, 0.9, 1.5))
    const mail = outExpo(seg(l, 2.2, 2.9))
    const fly = inOut(seg(l, 5.2, 6.6))
    return (
        <div className="wr-scene" style={{ opacity: 1 - out }}>
            <div className="wr-chapter" style={{ opacity: seg(l, 0.1, 0.5) }}><b>04</b> Claim it, or get it by email</div>
            <div className="wr-cal" style={{ opacity: seg(l, 0.8, 1.1), transform: `translateY(${(1 - cal) * 120}px) rotate(-3deg)` }}>
                <div className="wr-cal-head">Claim Schedule</div>
                <div className="wr-cal-grid">
                    {Array.from({ length: 28 }, (_, i) => {
                        const day = i + 1
                        const picked = day === 24
                        return <span key={i} className={picked ? 'is-picked' : ''} style={picked ? { transform: `scale(${lerp(1, 1.18, Math.sin(seg(l, 1.2, 1.7) * Math.PI))})` } : undefined}>{day}</span>
                    })}
                </div>
                <div className="wr-cal-foot"><b>Fri, Oct 24 · 9:00 AM</b><span>Registrar · Window 2</span></div>
            </div>
            <Window x={940} y={190} w={820} h={640} url="Inbox · juan.delacruz@hcdc.edu.ph" style={{ opacity: seg(l, 1.8, 2.2) }}>
                <div className="wr-inbox">
                    {[0, 1].map((i) => <div key={i} className="wr-mail is-old"><span /><div><b /><i /></div></div>)}
                    <div className="wr-mail is-new" style={{ transform: `translateX(${(1 - mail) * 110}%)`, opacity: mail }}>
                        <img src={hcdcLogo} alt="" />
                        <div>
                            <b>HCDC Registrar</b>
                            <strong>Your digital Transcript of Records (CERT-000124)</strong>
                            <small>Your official digital copy is attached. It is sealed on the Internet Computer blockchain…</small>
                            <div className="wr-attach" style={{ transform: `translate(${fly * -260}px, ${fly * 160}px) scale(${lerp(1, 1.5, fly)})`, opacity: 1 - seg(l, 6.3, 6.6) }}>
                                <span>PDF</span>
                                <div><b>CERT-000124.pdf</b><small>Sealed · DOC-104FF144700F</small></div>
                            </div>
                        </div>
                    </div>
                </div>
            </Window>
        </div>
    )
}

function SceneVerify({ t }) {
    const l = t - 45
    const out = seg(t, 53.7, 54)
    const enter = outExpo(seg(l, 0, 0.8))
    const drop1 = outBack(seg(l, 1.0, 1.4))
    const scan = seg(l, 1.8, 3.2)
    const good = l > 3.4
    const drop2 = outBack(seg(l, 5.0, 5.4))
    const bad = l > 6.8
    const showSecond = l > 4.9
    return (
        <div className="wr-scene" style={{ opacity: 1 - out }}>
            <div className="wr-chapter" style={{ opacity: seg(l, 0.1, 0.5) }}><b>05</b> Anyone can verify</div>
            <Window x={260} y={130} w={1400} h={820} url="certichain · /verify" style={{ opacity: enter, transform: `translateY(${(1 - enter) * 120}px)` }}>
                <div className="wr-verify">
                    <div className="wr-verify-hero">
                        <small>Official verification</small>
                        <h3>Verify a Credential</h3>
                        <div className="wr-verify-form"><span>e.g. CERT-000123 or DOC-…</span><b>Verify</b></div>
                        <div className={`wr-verify-drop${l > 1.0 && l < 1.6 ? ' is-hot' : ''}`}>Have a digital certificate file? <b>Check the file instead</b><small>The file stays on your device. Only its fingerprint is checked against the blockchain.</small></div>
                    </div>
                    {l > 1.6 && !showSecond && !good && (
                        <div className="wr-verify-scan">
                            <span className="wr-spin" style={{ transform: `rotate(${l * 600}deg)` }} />
                            <div><b>Computing SHA-256 on your device…</b><span className="wr-mono">{scramble(FINGERPRINT, scan, 9).slice(0, 34)}…</span></div>
                        </div>
                    )}
                    {good && !bad && (
                        <div className="wr-verify-result is-good" style={{ opacity: seg(l, 3.4, 3.7), transform: `translateY(${(1 - outBack(seg(l, 3.4, 3.9))) * 40}px)` }}>
                            <div className="wr-verify-banner"><span>✓</span><div><b>Genuine certificate file</b><small>This exact file was sealed by Holy Cross of Davao College and has not been changed by even one byte.</small></div></div>
                            <dl>
                                <div><dt>Document</dt><dd>Transcript of Records</dd></div>
                                <div><dt>Credential</dt><dd className="wr-mono">CERT-000124</dd></div>
                                <div><dt>Blockchain</dt><dd>Recorded #124 · Internet Computer</dd></div>
                                <div><dt>Encrypted copy</dt><dd>Decrypted · matches ✓</dd></div>
                            </dl>
                        </div>
                    )}
                    {bad && (
                        <div className="wr-verify-result is-bad" style={{ opacity: seg(l, 6.8, 7.1), transform: `translateX(${Math.sin(seg(l, 6.8, 7.3) * Math.PI * 6) * 14 * (1 - seg(l, 6.8, 7.3))}px)` }}>
                            <div className="wr-verify-banner"><span>?</span><div><b>No matching certificate</b><small>This file was changed after it was issued. Do not accept it.</small></div></div>
                            <dl>
                                <div><dt>Sealed fingerprint</dt><dd className="wr-mono">{FINGERPRINT.slice(0, 26)}…</dd></div>
                                <div><dt>This file</dt><dd className="wr-mono is-red">{EDITED.slice(0, 26)}…</dd></div>
                            </dl>
                        </div>
                    )}
                </div>
            </Window>
            {l > 0.6 && l < 1.6 && (
                <div className="wr-file" style={{ left: lerp(1700, 960, drop1), top: lerp(120, 560, drop1), opacity: 1 - seg(l, 1.4, 1.6), transform: `translate(-50%, -50%) rotate(${lerp(18, 0, drop1)}deg)` }}>
                    <span>PDF</span><b>CERT-000124.pdf</b>
                </div>
            )}
            {showSecond && l < 5.6 && (
                <div className="wr-file is-edited" style={{ left: lerp(1700, 960, drop2), top: lerp(120, 560, drop2), opacity: 1 - seg(l, 5.4, 5.6), transform: `translate(-50%, -50%) rotate(${lerp(-18, 0, drop2)}deg)` }}>
                    <span>PDF</span><b>CERT-000124 (edited).pdf</b>
                </div>
            )}
            <Kinetic text="Genuine…" t={t} start={48.6} className="is-lg is-green wr-verify-k1" />
            <Kinetic text="or not." t={t} start={52.0} className="is-lg is-red wr-verify-k2" />
        </div>
    )
}

function SceneOutro({ t }) {
    const l = t - 54
    const enter = outBack(seg(l, 0.2, 1.1))
    const fadeEnd = seg(t, 59.2, 60)
    return (
        <div className="wr-scene wr-center wr-outro" style={{ opacity: 1 - fadeEnd }}>
            <div style={{ transform: `scale(${lerp(0.5, 1, enter)})`, opacity: clamp(enter * 1.3) }}>
                <Mark size={220} p={seg(l, 0.2, 1.4)} />
            </div>
            <Kinetic text="CertiChain" t={t} start={55.0} step={0.05} className="is-brand is-dark" />
            <div className="wr-outro-tag">
                <Kinetic text="Your records," t={t} start={56.0} step={0.03} className="is-md is-dark" />{' '}
                <Kinetic text="verified and provable." t={t} start={56.5} step={0.03} className="is-md is-red" />
            </div>
            <div className="wr-outro-foot" style={{ opacity: seg(l, 3.4, 4) }}>
                <img src={hcdcLogo} alt="" />
                <span>Holy Cross of Davao College · Office of the Registrar</span>
                <i />
                <span>Sealed on the Internet Computer</span>
            </div>
        </div>
    )
}

export function Frame({ t }) {
    const hit = CUTS.reduce((m, c) => Math.max(m, t >= c && t < c + 0.18 ? 1 - (t - c) / 0.18 : 0), 0)
    const zoom = 1 + Math.pow(1 - ((t % BEAT) / BEAT), 6) * 0.006 * (t > 10 && t < 54 ? 1 : 0)
    return (
        <div className="wr-frame" style={{ transform: `scale(${zoom})` }}>
            <Background t={t} />
            {t < 6 && <SceneHook t={t} />}
            {t >= 6 && t < 10 && <SceneBrand t={t} />}
            {t >= 10 && t < 19 && <SceneStudent t={t} />}
            {t >= 19 && t < 27.4 && <SceneRegistrar t={t} />}
            {t >= 27.4 && t < 38 && <SceneChain t={t} />}
            {t >= 38 && t < 45 && <SceneDelivery t={t} />}
            {t >= 45 && t < 54 && <SceneVerify t={t} />}
            {t >= 54 && <SceneOutro t={t} />}
            <div className="wr-cutflash" style={{ opacity: hit * 0.5 }} />
            <div className="wr-vignette" />
        </div>
    )
}

