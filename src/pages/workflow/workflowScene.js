import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

// The 3D stage for the System Workflow presentation: one softly lit
// isometric platform with a station per step, joined by a glowing data path.
// The camera glides between stations; each station animates its step
// (setShot(id) -> local time t drives that station's animation).

const COLORS = {
    bg: 0x0a1424,
    floor: 0x13233b,
    floorEdge: 0x1c3456,
    navy: 0x123b78,
    blue: 0x3b82f6,
    sky: 0x7cc4ff,
    red: 0xc8102e,
    gold: 0xe6b54a,
    green: 0x22c55e,
    paper: 0xf7f4ec,
    desk: 0xd8dde6,
    deskDark: 0x2b3446,
    skin: 0xe0b48f,
    skin2: 0xc68e66,
}

const FONT = '"Inter", "Segoe UI", system-ui, sans-serif'

// Station positions on the platform (x, z).
const STATIONS = {
    request: [-31, 6],
    upload: [-23, -2],
    payment: [-14, 7],
    record: [-5, -6],
    process: [4, 2],
    generate: [13, -5],
    digital: [21, 6],
    physical: [27, -9],
    complete: [36, 0],
}

// Camera framing per shot: the station it looks at (y = look height, dz =
// nudge), and the camera's offset from that point.
const SHOT_FRAMING = {
    request: { at: 'request', y: 2.4, offset: [-7, 6.5, 12] },
    upload: { at: 'upload', y: 2.6, offset: [-6, 6, 12] },
    payment: { at: 'payment', y: 2.4, offset: [-6, 6, 12.5] },
    record: { at: 'record', y: 2.8, offset: [-7, 6.5, 12.5] },
    process: { at: 'process', y: 2.4, offset: [-6, 6.5, 12] },
    generate: { at: 'generate', y: 3, offset: [-5, 5, 12] },
    digital: { at: 'digital', y: 2.8, offset: [-5, 5, 11] },
    physical: { at: 'physical', y: 2.8, offset: [-6, 6, 12] },
    complete: { at: 'complete', y: 2.6, dz: -0.4, offset: [-6, 6.5, 13.5] },
}
const CAMERA = {
    intro: { target: [3, 0, 0], offset: [-30, 34, 47] },
    finale: { target: [3, 0, 0], offset: [-26, 38, 51] },
    ...Object.fromEntries(Object.entries(SHOT_FRAMING).map(([id, f]) => [id, {
        target: [STATIONS[f.at][0], f.y, STATIONS[f.at][1] + (f.dz || 0)],
        offset: f.offset,
    }])),
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const easeOut = (x) => 1 - Math.pow(1 - x, 3)
const clamp01 = (x) => Math.min(1, Math.max(0, x))
// 0..1 progress of t between a and b.
const span = (t, a, b) => clamp01((t - a) / (b - a))
const popIn = (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

// ---- Canvas-drawn panels (floating UI, screens, documents) ---------------

function roundRect(g, x, y, w, h, r) {
    g.beginPath()
    g.moveTo(x + r, y)
    g.arcTo(x + w, y, x + w, y + h, r)
    g.arcTo(x + w, y + h, x, y + h, r)
    g.arcTo(x, y + h, x, y, r)
    g.arcTo(x, y, x + w, y, r)
    g.closePath()
}

function checkMark(g, cx, cy, s, color = '#22c55e') {
    g.save()
    g.fillStyle = color
    g.beginPath()
    g.arc(cx, cy, s, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#fff'
    g.lineWidth = s * 0.26
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(cx - s * 0.45, cy + s * 0.02)
    g.lineTo(cx - s * 0.1, cy + s * 0.36)
    g.lineTo(cx + s * 0.48, cy - s * 0.32)
    g.stroke()
    g.restore()
}

// A plane with a canvas texture; draw(g, w, h, state) paints it.
function canvasPanel(width, height, draw, { pxPerUnit = 220, transparent = true, emissive = true, side = THREE.FrontSide } = {}) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * pxPerUnit)
    canvas.height = Math.round(height * pxPerUnit)
    const g = canvas.getContext('2d')
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    const material = emissive
        ? new THREE.MeshBasicMaterial({ map: texture, transparent, side, toneMapped: false })
        : new THREE.MeshStandardMaterial({ map: texture, transparent, side, roughness: 0.85 })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    let lastKey = null
    const redraw = (state = {}) => {
        const key = JSON.stringify(state)
        if (key === lastKey) return
        lastKey = key
        g.clearRect(0, 0, canvas.width, canvas.height)
        draw(g, canvas.width, canvas.height, state)
        texture.needsUpdate = true
    }
    redraw({})
    return { mesh, redraw, material }
}

// Floating UI card look.
function cardBackground(g, w, h, { accent = '#3b82f6' } = {}) {
    const r = Math.min(w, h) * 0.06
    g.save()
    roundRect(g, 4, 4, w - 8, h - 8, r)
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, 'rgba(255,255,255,0.97)')
    grad.addColorStop(1, 'rgba(236,242,250,0.95)')
    g.fillStyle = grad
    g.fill()
    g.lineWidth = 4
    g.strokeStyle = 'rgba(124,196,255,0.9)'
    g.stroke()
    g.clip()
    g.fillStyle = accent
    g.fillRect(0, 0, w, h * 0.13)
    g.restore()
}

function cardTitle(g, w, h, title) {
    g.fillStyle = '#fff'
    g.font = `700 ${Math.round(h * 0.065)}px ${FONT}`
    g.textBaseline = 'middle'
    g.fillText(title, w * 0.06, h * 0.068)
}

function text(g, str, x, y, size, { color = '#0f1f38', weight = 500, align = 'left' } = {}) {
    g.fillStyle = color
    g.font = `${weight} ${Math.round(size)}px ${FONT}`
    g.textAlign = align
    g.textBaseline = 'middle'
    g.fillText(str, x, y)
    g.textAlign = 'left'
}

// ---- Models -----------------------------------------------------------------

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra })

function shadowed(obj) {
    obj.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true
            o.receiveShadow = true
        }
    })
    return obj
}

function makePerson({ top, bottom = 0x1e293b, skin = COLORS.skin, hair = 0x1b1410, lanyard = null, seated = false }) {
    const person = new THREE.Group()
    const topMat = std(top, { roughness: 0.7 })
    const skinMat = std(skin, { roughness: 0.6 })
    const legMat = std(bottom, { roughness: 0.75 })

    const legs = new THREE.Group()
    for (const x of [-0.17, 0.17]) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, seated ? 0.35 : 0.72, 6, 12), legMat)
        leg.position.set(x, seated ? 0.62 : 0.5, seated ? 0.22 : 0)
        if (seated) leg.rotation.x = Math.PI / 2
        legs.add(leg)
        const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.12, 0.36, 2, 0.05), std(0x111827))
        shoe.position.set(x, 0.06, seated ? 0.5 : 0.06)
        legs.add(shoe)
        if (seated) {
            const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 6, 12), legMat)
            shin.position.set(x, 0.32, 0.45)
            legs.add(shin)
        }
    }
    person.add(legs)

    const body = new THREE.Group()
    body.position.y = seated ? 0.78 : 1.05
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.55, 8, 16), topMat)
    torso.position.y = 0.42
    torso.scale.set(1, 1, 0.72)
    body.add(torso)
    if (lanyard) {
        const card = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.22, 0.03, 2, 0.01), std(lanyard))
        card.position.set(0, 0.32, 0.26)
        body.add(card)
    }
    const arms = []
    for (const side of [-1, 1]) {
        const arm = new THREE.Group()
        arm.position.set(side * 0.43, 0.76, 0)
        const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 6, 12), topMat)
        upper.position.y = -0.3
        arm.add(upper)
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), skinMat)
        hand.position.y = -0.64
        arm.add(hand)
        arm.rotation.z = side * 0.12
        body.add(arm)
        arms.push(arm)
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 12), skinMat)
    neck.position.y = 0.97
    body.add(neck)
    const head = new THREE.Group()
    head.position.y = 1.25
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 18), skinMat)
    skull.scale.set(0.95, 1.05, 0.98)
    head.add(skull)
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.285, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), std(hair, { roughness: 0.9 }))
    hairCap.rotation.x = -0.25
    hairCap.position.set(0, 0.03, -0.02)
    head.add(hairCap)
    body.add(head)
    person.add(body)

    person.userData = { body, head, arms, seated }
    return shadowed(person)
}

function makeDesk(width = 2.6, depth = 1.3) {
    const desk = new THREE.Group()
    const top = new THREE.Mesh(new RoundedBoxGeometry(width, 0.1, depth, 3, 0.04), std(COLORS.desk, { roughness: 0.4 }))
    top.position.y = 1.0
    desk.add(top)
    for (const x of [-1, 1]) {
        const side = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.98, depth * 0.9, 2, 0.03), std(COLORS.deskDark))
        side.position.set(x * (width / 2 - 0.12), 0.5, 0)
        desk.add(side)
    }
    return shadowed(desk)
}

function makeChair() {
    const chair = new THREE.Group()
    const mat = std(0x1f2937, { roughness: 0.6 })
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.12, 0.72, 2, 0.05), mat)
    seat.position.y = 0.6
    chair.add(seat)
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.8, 0.1, 2, 0.05), mat)
    back.position.set(0, 1.05, -0.33)
    chair.add(back)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 10), std(0x9ca3af, { metalness: 0.6 }))
    post.position.y = 0.3
    chair.add(post)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 20), std(0x374151))
    base.position.y = 0.04
    chair.add(base)
    return shadowed(chair)
}

function makeLaptop(screen) {
    const laptop = new THREE.Group()
    const base = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.05, 0.8, 2, 0.02), std(0xc7ccd6, { metalness: 0.5, roughness: 0.3 }))
    laptop.add(base)
    const lid = new THREE.Group()
    lid.position.set(0, 0.03, -0.38)
    lid.rotation.x = -0.28
    const shell = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.78, 0.04, 2, 0.02), std(0xb9c0cc, { metalness: 0.5, roughness: 0.3 }))
    shell.position.y = 0.39
    lid.add(shell)
    screen.mesh.position.set(0, 0.39, 0.025)
    lid.add(screen.mesh)
    laptop.add(lid)
    return shadowed(laptop)
}

function makeMonitor(screen, w = 1.5, h = 0.92) {
    const mon = new THREE.Group()
    const frame = new THREE.Mesh(new RoundedBoxGeometry(w + 0.08, h + 0.08, 0.06, 2, 0.02), std(0x1f2937, { roughness: 0.4 }))
    frame.position.y = 0.75
    mon.add(frame)
    screen.mesh.position.set(0, 0.75, 0.035)
    mon.add(screen.mesh)
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.06), std(0x6b7280, { metalness: 0.6 }))
    neck.position.set(0, 0.17, -0.03)
    mon.add(neck)
    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.03, 0.3, 2, 0.01), std(0x6b7280, { metalness: 0.6 }))
    mon.add(foot)
    return shadowed(mon)
}

function makePedestal(radius = 1.1, color = COLORS.navy) {
    const p = new THREE.Group()
    const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, 0.3, 48), std(0x1a2a44, { roughness: 0.3, metalness: 0.3 }))
    base.position.y = 0.15
    p.add(base)
    const ringMat = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.9 })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.92, 0.025, 8, 64), ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.31
    p.add(ring)
    p.userData.ringMat = ringMat
    return shadowed(p)
}

function makeDocument(panel, w, h) {
    const doc = new THREE.Group()
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), std(COLORS.paper, { roughness: 0.9 }))
    doc.add(sheet)
    panel.mesh.position.z = 0.012
    doc.add(panel.mesh)
    return shadowed(doc)
}

// Station number badge that floats above each station.
function makeBadge(number, label) {
    const panel = canvasPanel(3.2, 0.8, (g, w, h, s) => {
        g.save()
        roundRect(g, 6, 6, w - 12, h - 12, (h - 12) / 2)
        g.fillStyle = s.active ? 'rgba(18,59,120,0.95)' : s.done ? 'rgba(14,30,54,0.85)' : 'rgba(14,30,54,0.7)'
        g.fill()
        g.lineWidth = 5
        g.strokeStyle = s.active ? '#7cc4ff' : s.done ? 'rgba(34,197,94,0.8)' : 'rgba(124,196,255,0.35)'
        g.stroke()
        g.beginPath()
        g.arc(h / 2, h / 2, h * 0.3, 0, Math.PI * 2)
        g.fillStyle = s.done ? '#22c55e' : s.active ? '#3b82f6' : 'rgba(124,196,255,0.25)'
        g.fill()
        text(g, String(number), h / 2, h / 2 + 1, h * 0.34, { color: '#fff', weight: 800, align: 'center' })
        text(g, label, h * 1.0, h / 2 + 1, h * 0.3, { color: s.active ? '#fff' : 'rgba(226,236,250,0.85)', weight: 700 })
        g.restore()
    })
    return panel
}

// ---- The scene ----------------------------------------------------------------

export function createWorkflowScene(container) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(COLORS.bg)
    scene.fog = new THREE.Fog(COLORS.bg, 55, 130)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTexture
    scene.environmentIntensity = 0.45

    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 400)

    // Lights: soft sky, a warm key light with shadows, a cool rim.
    scene.add(new THREE.HemisphereLight(0xbcd7ff, 0x0b1220, 0.55))
    const key = new THREE.DirectionalLight(0xfff1dc, 2.1)
    key.position.set(-20, 40, 26)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -60
    key.shadow.camera.right = 60
    key.shadow.camera.top = 40
    key.shadow.camera.bottom = -40
    key.shadow.camera.far = 140
    key.shadow.bias = -0.0004
    key.shadow.radius = 4
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x7cc4ff, 0.9)
    rim.position.set(30, 18, -30)
    scene.add(rim)

    // A spotlight that follows the active station.
    const focus = new THREE.SpotLight(0xffffff, 0, 30, Math.PI / 7, 0.6, 1.4)
    focus.position.set(0, 16, 6)
    scene.add(focus)
    scene.add(focus.target)

    // Platform.
    const world = new THREE.Group()
    scene.add(world)
    const platform = new THREE.Mesh(new RoundedBoxGeometry(92, 1.2, 40, 4, 0.5), std(COLORS.floor, { roughness: 0.62, metalness: 0.15 }))
    platform.position.set(8, -0.6, 0)
    platform.receiveShadow = true
    world.add(platform)
    const grid = new THREE.GridHelper(92, 46, 0x2c4a74, 0x1a3150)
    grid.position.set(8, 0.005, 0)
    grid.scale.z = 40 / 92
    grid.material.transparent = true
    grid.material.opacity = 0.35
    world.add(grid)
    const edge = new THREE.Mesh(new THREE.BoxGeometry(92.2, 0.06, 40.2), new THREE.MeshBasicMaterial({ color: COLORS.floorEdge }))
    edge.position.set(8, -1.18, 0)
    world.add(edge)

    // ---- Data path joining the stations -----------------------------------
    const order = ['request', 'upload', 'payment', 'record', 'process', 'generate', 'digital', 'physical', 'complete']
    const pathPoints = order.map((k) => new THREE.Vector3(STATIONS[k][0], 0.06, STATIONS[k][1]))
    const curve = new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal')
    const pathMat = new THREE.MeshBasicMaterial({ color: 0x2b5a99, transparent: true, opacity: 0.75, toneMapped: false })
    const pathTube = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.05, 8, false), pathMat)
    world.add(pathTube)
    // Brighter overlay that "fills" the path up to the current station.
    const fillGeo = new THREE.TubeGeometry(curve, 400, 0.075, 8, false)
    const fillMat = new THREE.MeshBasicMaterial({ color: COLORS.sky, transparent: true, opacity: 0.95, toneMapped: false })
    const pathFill = new THREE.Mesh(fillGeo, fillMat)
    fillGeo.setDrawRange(0, 0)
    world.add(pathFill)
    const fillIndexCount = fillGeo.index.count
    const stationU = order.map((_, i) => i / (order.length - 1))

    // Pulses travelling along the path.
    const pulseGeo = new THREE.SphereGeometry(0.11, 12, 10)
    const pulses = []
    for (let i = 0; i < 26; i++) {
        const m = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: COLORS.sky, transparent: true, opacity: 0.85, toneMapped: false }))
        m.userData.u = i / 26
        world.add(m)
        pulses.push(m)
    }

    // Floating ambient particles.
    const particleCount = 520
    const particleGeo = new THREE.BufferGeometry()
    const pos = new Float32Array(particleCount * 3)
    const speeds = new Float32Array(particleCount)
    for (let i = 0; i < particleCount; i++) {
        pos[i * 3] = -40 + Math.random() * 96
        pos[i * 3 + 1] = Math.random() * 16
        pos[i * 3 + 2] = -22 + Math.random() * 44
        speeds[i] = 0.12 + Math.random() * 0.35
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const dotCanvas = document.createElement('canvas')
    dotCanvas.width = dotCanvas.height = 64
    const dg = dotCanvas.getContext('2d')
    const rg = dg.createRadialGradient(32, 32, 0, 32, 32, 32)
    rg.addColorStop(0, 'rgba(255,255,255,1)')
    rg.addColorStop(0.4, 'rgba(160,210,255,0.5)')
    rg.addColorStop(1, 'rgba(160,210,255,0)')
    dg.fillStyle = rg
    dg.fillRect(0, 0, 64, 64)
    const dotTex = new THREE.CanvasTexture(dotCanvas)
    const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
        size: 0.22, map: dotTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }))
    scene.add(particles)

    // Short-lived sparkle bursts (confirmations).
    const burstGeo = new THREE.BufferGeometry()
    const burstCount = 160
    const burstPos = new Float32Array(burstCount * 3)
    const burstVel = new Float32Array(burstCount * 3)
    burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3))
    const burstMat = new THREE.PointsMaterial({ size: 0.28, map: dotTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xbfe3ff, toneMapped: false })
    const burst = new THREE.Points(burstGeo, burstMat)
    scene.add(burst)
    let burstAge = 99
    const sparkle = (x, y, z, color = 0xbfe3ff) => {
        burstMat.color.set(color)
        for (let i = 0; i < burstCount; i++) {
            burstPos[i * 3] = x
            burstPos[i * 3 + 1] = y
            burstPos[i * 3 + 2] = z
            const a = Math.random() * Math.PI * 2
            const b = Math.random() * Math.PI - Math.PI / 2
            const s = 1.5 + Math.random() * 2.5
            burstVel[i * 3] = Math.cos(a) * Math.cos(b) * s
            burstVel[i * 3 + 1] = Math.abs(Math.sin(b)) * s + 1
            burstVel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s
        }
        burstGeo.attributes.position.needsUpdate = true
        burstAge = 0
    }

    const at = (key, y = 0) => new THREE.Vector3(STATIONS[key][0], y, STATIONS[key][1])
    const station = {}
    const badges = {}

    // ---- 1. Student request: desk, laptop, student --------------------------
    {
        const g = new THREE.Group()
        g.position.copy(at('request'))
        g.rotation.y = 0.25
        world.add(g)
        const desk = makeDesk()
        g.add(desk)
        const chair = makeChair()
        chair.position.set(0, 0, 1.15)
        chair.rotation.y = Math.PI
        g.add(chair)
        const student = makePerson({ top: COLORS.navy, bottom: 0x334155, hair: 0x2a1a12, seated: true })
        student.position.set(0, 0, 1.0)
        student.rotation.y = Math.PI
        g.add(student)
        const screen = canvasPanel(1.12, 0.7, (c, w, h, s) => {
            c.fillStyle = '#0f1f38'
            c.fillRect(0, 0, w, h)
            c.fillStyle = '#123b78'
            c.fillRect(0, 0, w, h * 0.16)
            text(c, 'CertiChain · New Request', w * 0.05, h * 0.08, h * 0.075, { color: '#fff', weight: 700 })
            const rows = ['Document', 'Quantity', 'Purpose']
            rows.forEach((r, i) => {
                const y = h * (0.28 + i * 0.17)
                text(c, r, w * 0.06, y, h * 0.058, { color: '#9fb6d6', weight: 600 })
                c.fillStyle = 'rgba(255,255,255,0.12)'
                roundRect(c, w * 0.34, y - h * 0.055, w * 0.6, h * 0.11, 8)
                c.fill()
                if ((s.filled || 0) > i) text(c, ['Transcript of Records', '1 copy', 'Employment'][i], w * 0.37, y, h * 0.058, { color: '#fff', weight: 600 })
            })
            c.fillStyle = s.pressed ? '#22c55e' : '#3b82f6'
            roundRect(c, w * 0.6, h * 0.8, w * 0.34, h * 0.12, 10)
            c.fill()
            text(c, s.pressed ? 'Submitted ✓' : 'Submit', w * 0.77, h * 0.86, h * 0.06, { color: '#fff', weight: 700, align: 'center' })
        })
        const laptop = makeLaptop(screen)
        laptop.position.set(0, 1.08, 0.05)
        // The screen faces the student (who sits on +z) and the camera behind them.
        g.add(laptop)

        // Floating request card that rises from the laptop.
        const card = canvasPanel(2.6, 1.7, (c, w, h, s) => {
            cardBackground(c, w, h)
            cardTitle(c, w, h, 'Document Request')
            const lines = [['Document', 'Transcript of Records'], ['Copies', '1'], ['Purpose', 'Employment'], ['Reference', s.pressed ? 'REQ-000124' : 'Given on submit']]
            lines.forEach(([k, v], i) => {
                const y = h * (0.26 + i * 0.13)
                text(c, k, w * 0.07, y, h * 0.06, { color: '#5b6b82', weight: 600 })
                text(c, v, w * 0.38, y, h * 0.064, { color: '#0f1f38', weight: 700 })
            })
            c.fillStyle = s.pressed ? '#22c55e' : '#123b78'
            roundRect(c, w * 0.56, h * 0.8, w * 0.38, h * 0.13, 14)
            c.fill()
            text(c, s.pressed ? 'Request sent ✓' : 'Submit request', w * 0.75, h * 0.865, h * 0.06, { color: '#fff', weight: 700, align: 'center' })
        })
        card.mesh.position.set(0, 2.6, 0.4)
        card.mesh.scale.setScalar(0.001)
        g.add(card.mesh)

        // A small glowing "request" token that leaves along the path.
        const token = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.55, 0.06, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: COLORS.sky, emissiveIntensity: 1.3 }))
        token.visible = false
        world.add(token)

        station.request = { group: g, student, screen, card, token, laptop }
    }

    // ---- 2. Upload requirements: hologram pedestal with documents ------------
    {
        const g = new THREE.Group()
        g.position.copy(at('upload'))
        world.add(g)
        const pedestal = makePedestal(1.4, COLORS.sky)
        g.add(pedestal)
        const beamMat = new THREE.MeshBasicMaterial({ color: COLORS.sky, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 4.2, 40, 1, true), beamMat)
        beam.position.y = 2.4
        g.add(beam)

        const docDraw = (title, lines) => (c, w, h) => {
            c.fillStyle = '#fbfaf6'
            c.fillRect(0, 0, w, h)
            c.fillStyle = '#123b78'
            c.fillRect(0, 0, w, h * 0.14)
            text(c, title, w * 0.08, h * 0.07, h * 0.07, { color: '#fff', weight: 800 })
            for (let i = 0; i < lines; i++) {
                c.fillStyle = 'rgba(15,31,56,0.18)'
                c.fillRect(w * 0.08, h * (0.24 + i * 0.09), w * (0.84 - (i % 3) * 0.14), h * 0.035)
            }
        }
        const docs = [
            ['Valid ID', 5],
            ['Clearance', 7],
            ['Requirement', 6],
        ].map(([title, lines], i) => {
            const panel = canvasPanel(0.9, 1.2, docDraw(title, lines), { emissive: false, transparent: false })
            const doc = makeDocument(panel, 0.9, 1.2)
            doc.userData.start = new THREE.Vector3(-3.4 + i * 0.25, 1.2 + i * 0.15, 1.6 - i * 0.5)
            doc.userData.end = new THREE.Vector3(-0.9 + i * 0.9, 2.3 + (i % 2) * 0.35, 0)
            doc.position.copy(doc.userData.start)
            g.add(doc)
            return doc
        })

        const progress = canvasPanel(2.8, 0.9, (c, w, h, s) => {
            cardBackground(c, w, h, { accent: '#123b78' })
            const p = s.p || 0
            text(c, p >= 1 ? 'Requirements uploaded' : 'Uploading requirements…', w * 0.06, h * 0.36, h * 0.15, { weight: 700 })
            c.fillStyle = 'rgba(15,31,56,0.12)'
            roundRect(c, w * 0.06, h * 0.6, w * 0.88, h * 0.14, h * 0.07)
            c.fill()
            c.fillStyle = p >= 1 ? '#22c55e' : '#3b82f6'
            roundRect(c, w * 0.06, h * 0.6, Math.max(h * 0.14, w * 0.88 * p), h * 0.14, h * 0.07)
            c.fill()
            text(c, `${Math.round(p * 100)}%`, w * 0.94, h * 0.36, h * 0.14, { color: '#123b78', weight: 800, align: 'right' })
        })
        progress.mesh.position.set(0, 4.35, 0.3)
        progress.mesh.scale.setScalar(0.001)
        g.add(progress.mesh)

        const student = makePerson({ top: COLORS.navy, bottom: 0x334155, hair: 0x2a1a12 })
        student.position.set(-3.6, 0, 2.4)
        student.rotation.y = 0.9
        g.add(student)

        station.upload = { group: g, pedestal, beamMat, docs, progress, student }
    }

    // ---- 3. Payment: Finance Office window, Official Receipt upload ------------
    // There is no online payment: the student pays at the Finance Office and
    // uploads the receipt, which stays "awaiting verification" until the
    // Registrar checks it at the next station.
    {
        const g = new THREE.Group()
        g.position.copy(at('payment'))
        world.add(g)

        const booth = new THREE.Group()
        // Wall built around an open window (1.7 x 1.0) so the cashier shows through.
        const wallMat = std(0xe9edf4, { roughness: 0.5 })
        for (const [w, h, x, y] of [[3.4, 1.25, 0, 0.625], [3.4, 0.75, 0, 2.625], [0.85, 1.0, -1.275, 1.75], [0.85, 1.0, 1.275, 1.75]]) {
            const part = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.4, 2, 0.04), wallMat)
            part.position.set(x, y, 0)
            booth.add(part)
        }
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0), new THREE.MeshStandardMaterial({ color: 0x9cc8f0, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.22 }))
        glass.position.set(0, 1.75, 0.21)
        booth.add(glass)
        const counter = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.12, 0.6, 2, 0.04), std(COLORS.desk))
        counter.position.set(0, 1.15, 0.45)
        booth.add(counter)
        const sign = canvasPanel(2.8, 0.5, (c, w, h) => {
            c.fillStyle = '#123b78'
            roundRect(c, 0, 0, w, h, h * 0.2)
            c.fill()
            text(c, 'HCDC FINANCE OFFICE · CASHIER', w / 2, h / 2 + 1, h * 0.28, { color: '#fff', weight: 800, align: 'center' })
        })
        sign.mesh.position.set(0, 2.75, 0.22)
        booth.add(sign.mesh)
        const cashier = makePerson({ top: COLORS.gold, bottom: 0x1f2937, skin: COLORS.skin2, hair: 0x0f0a08 })
        cashier.position.set(0, 0, -0.6)
        cashier.scale.setScalar(0.92)
        booth.add(cashier)
        booth.position.set(1.6, 0, -1.2)
        booth.rotation.y = -0.3
        g.add(shadowed(booth))

        // The Official Receipt the cashier hands over.
        const receiptPanel = canvasPanel(0.8, 1.05, (c, w, h) => {
            c.fillStyle = '#fffdf6'
            c.fillRect(0, 0, w, h)
            text(c, 'OFFICIAL RECEIPT', w * 0.5, h * 0.09, h * 0.065, { color: '#123b78', weight: 800, align: 'center' })
            text(c, 'Holy Cross of Davao College', w * 0.5, h * 0.17, h * 0.042, { color: '#5b6b82', weight: 600, align: 'center' })
            text(c, 'OR No. 0084213', w * 0.08, h * 0.32, h * 0.055, { color: '#0f1f38', weight: 800 })
            for (let i = 0; i < 4; i++) {
                c.fillStyle = 'rgba(15,31,56,0.16)'
                c.fillRect(w * 0.08, h * (0.42 + i * 0.08), w * (0.8 - (i % 2) * 0.2), h * 0.025)
            }
            text(c, 'TOTAL  ₱150.00', w * 0.92, h * 0.82, h * 0.06, { color: '#0f1f38', weight: 800, align: 'right' })
        }, { emissive: false, transparent: false })
        const receipt = makeDocument(receiptPanel, 0.8, 1.05)
        receipt.userData.start = new THREE.Vector3(1.4, 1.4, -0.4)
        receipt.userData.hand = new THREE.Vector3(-0.9, 1.55, 1.0)
        receipt.userData.up = new THREE.Vector3(-0.6, 3.6, 0.6)
        receipt.position.copy(receipt.userData.start)
        receipt.scale.setScalar(0.001)
        g.add(receipt)

        // The student's upload, on the request page.
        const card = canvasPanel(3.0, 1.15, (c, w, h, s) => {
            cardBackground(c, w, h, { accent: s.done ? '#b8892b' : '#123b78' })
            text(c, 'Upload Official Receipt · REQ-000124', w * 0.06, h * 0.24, h * 0.1, { color: '#5b6b82', weight: 700 })
            text(c, s.done ? 'Uploaded · awaiting verification' : 'OR No. 0084213 · ₱150.00', w * 0.06, h * 0.47, h * 0.13, { weight: 800 })
            const p = s.p || 0
            c.fillStyle = 'rgba(15,31,56,0.12)'
            roundRect(c, w * 0.06, h * 0.68, w * 0.88, h * 0.12, h * 0.06)
            c.fill()
            c.fillStyle = s.done ? '#e6b54a' : '#3b82f6'
            roundRect(c, w * 0.06, h * 0.68, Math.max(h * 0.12, w * 0.88 * p), h * 0.12, h * 0.06)
            c.fill()
        })
        card.mesh.position.set(-0.6, 4.3, 0.6)
        card.mesh.scale.setScalar(0.001)
        g.add(card.mesh)

        const student = makePerson({ top: COLORS.navy, bottom: 0x334155, hair: 0x2a1a12 })
        student.userData.start = new THREE.Vector3(-2.6, 0, 2.6)
        student.userData.end = new THREE.Vector3(-1.2, 0, 1.3)
        student.position.copy(student.userData.start)
        // Faces the cashier window.
        student.rotation.y = 2.3
        g.add(student)

        station.payment = { group: g, receipt, card, student, cashier }
    }

    // ---- 4. Registrar review: employee checks the request ----------------------
    {
        const g = new THREE.Group()
        g.position.copy(at('record'))
        world.add(g)
        const desk = makeDesk(2.2, 1.1)
        desk.position.set(2.2, 0, 0.6)
        desk.rotation.y = -0.35
        g.add(desk)
        const screen = canvasPanel(1.42, 0.86, (c, w, h, s) => {
            c.fillStyle = '#0f1f38'
            c.fillRect(0, 0, w, h)
            text(c, 'Review · REQ-000124', w * 0.05, h * 0.1, h * 0.08, { color: '#7cc4ff', weight: 700 })
            for (let i = 0; i < 6; i++) {
                c.fillStyle = i < (s.rows || 0) ? 'rgba(124,196,255,0.45)' : 'rgba(255,255,255,0.08)'
                c.fillRect(w * 0.05, h * (0.24 + i * 0.12), w * 0.9, h * 0.07)
            }
        })
        const monitor = makeMonitor(screen)
        monitor.position.set(2.2, 1.05, 0.3)
        monitor.rotation.y = -0.35
        g.add(monitor)
        const chair = makeChair()
        chair.position.set(2.55, 0, 1.6)
        chair.rotation.y = Math.PI - 0.35
        g.add(chair)
        const employee = makePerson({ top: COLORS.red, bottom: 0x1f2937, skin: COLORS.skin2, hair: 0x0f0a08, lanyard: 0xffffff, seated: true })
        employee.position.set(2.5, 0, 1.45)
        employee.rotation.y = Math.PI - 0.35
        g.add(employee)

        const record = canvasPanel(3.0, 2.2, (c, w, h, s) => {
            cardBackground(c, w, h)
            cardTitle(c, w, h, 'Registrar Review')
            const rows = [['Student No.', '2021-0457'], ['Program', 'BS Info Technology'], ['Requirements', 'Valid ID, Clearance'], ['Official Receipt', 'OR No. 0084213']]
            rows.forEach(([k, v], i) => {
                if (i >= (s.rows || 0)) return
                const y = h * (0.25 + i * 0.12)
                text(c, k, w * 0.07, y, h * 0.052, { color: '#5b6b82', weight: 600 })
                text(c, v, w * 0.4, y, h * 0.056, { color: '#0f1f38', weight: 700 })
                checkMark(c, w * 0.91, y, h * 0.03)
            })
            if (s.verified) {
                c.fillStyle = 'rgba(34,197,94,0.12)'
                roundRect(c, w * 0.07, h * 0.76, w * 0.86, h * 0.15, 14)
                c.fill()
                checkMark(c, w * 0.14, h * 0.835, h * 0.045)
                text(c, 'Payment verified · approved', w * 0.21, h * 0.835, h * 0.058, { color: '#15803d', weight: 800 })
            }
        })
        record.mesh.position.set(0.2, 3.9, 0.6)
        record.mesh.scale.setScalar(0.001)
        g.add(record.mesh)

        station.record = { group: g, screen, record, employee }
    }

    // ---- 4. Processing: employee desk, checklist, document ---------------------
    {
        const g = new THREE.Group()
        g.position.copy(at('process'))
        world.add(g)
        const desk = makeDesk(3.0, 1.4)
        g.add(desk)
        const screen = canvasPanel(1.42, 0.86, (c, w, h, s) => {
            c.fillStyle = '#0f1f38'
            c.fillRect(0, 0, w, h)
            text(c, 'Request REQ-000124', w * 0.05, h * 0.1, h * 0.08, { color: '#7cc4ff', weight: 700 })
            c.fillStyle = 'rgba(255,255,255,0.08)'
            c.fillRect(w * 0.05, h * 0.25, w * 0.9, h * 0.62)
            c.fillStyle = '#3b82f6'
            c.fillRect(w * 0.05, h * 0.25, w * 0.9 * (s.p || 0), h * 0.05)
        })
        const monitor = makeMonitor(screen)
        monitor.position.set(-0.6, 1.05, -0.3)
        g.add(monitor)
        const stack = new THREE.Group()
        for (let i = 0; i < 5; i++) {
            const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.025, 0.95), std(COLORS.paper, { roughness: 0.9 }))
            sheet.position.set(0, i * 0.03, 0)
            sheet.rotation.y = (Math.random() - 0.5) * 0.12
            stack.add(sheet)
        }
        stack.position.set(1.0, 1.07, -0.1)
        g.add(shadowed(stack))
        const docPanel = canvasPanel(0.7, 0.95, (c, w, h) => {
            c.fillStyle = '#fbfaf6'
            c.fillRect(0, 0, w, h)
            c.fillStyle = '#123b78'
            c.fillRect(w * 0.1, h * 0.08, w * 0.8, h * 0.06)
            for (let i = 0; i < 8; i++) {
                c.fillStyle = 'rgba(15,31,56,0.18)'
                c.fillRect(w * 0.1, h * (0.24 + i * 0.08), w * (0.8 - (i % 3) * 0.12), h * 0.03)
            }
        }, { emissive: false, transparent: false })
        const doc = makeDocument(docPanel, 0.7, 0.95)
        doc.rotation.x = -Math.PI / 2
        doc.userData.start = new THREE.Vector3(1.0, 1.25, -0.1)
        doc.userData.end = new THREE.Vector3(0.35, 1.08, 0.3)
        doc.position.copy(doc.userData.start)
        g.add(doc)
        const chair = makeChair()
        chair.position.set(-0.4, 0, 1.2)
        chair.rotation.y = Math.PI
        g.add(chair)
        const employee = makePerson({ top: COLORS.red, bottom: 0x1f2937, skin: COLORS.skin2, hair: 0x0f0a08, lanyard: 0xffffff, seated: true })
        employee.position.set(-0.4, 0, 1.05)
        employee.rotation.y = Math.PI
        g.add(employee)

        const checklist = canvasPanel(2.8, 2.0, (c, w, h, s) => {
            cardBackground(c, w, h)
            cardTitle(c, w, h, 'Processing the Request')
            const steps = ['Payment verified', 'Document prepared', 'Passed to production', 'Passed to claiming section']
            steps.forEach((label, i) => {
                const y = h * (0.28 + i * 0.15)
                const done = i < (s.done || 0)
                if (done) checkMark(c, w * 0.1, y, h * 0.04)
                else {
                    c.strokeStyle = 'rgba(15,31,56,0.25)'
                    c.lineWidth = 4
                    c.beginPath()
                    c.arc(w * 0.1, y, h * 0.04, 0, Math.PI * 2)
                    c.stroke()
                }
                text(c, label, w * 0.18, y, h * 0.062, { color: done ? '#0f1f38' : '#8a98ad', weight: done ? 700 : 500 })
            })
        })
        checklist.mesh.position.set(2.6, 3.4, 0.4)
        checklist.mesh.rotation.y = -0.25
        checklist.mesh.scale.setScalar(0.001)
        g.add(checklist.mesh)

        station.process = { group: g, screen, doc, checklist, employee }
    }

    // ---- 6. Document ready: the finished document ------------------------------
    {
        const g = new THREE.Group()
        g.position.copy(at('generate'))
        world.add(g)
        const pedestal = makePedestal(1.6, COLORS.gold)
        g.add(pedestal)

        const certPanel = canvasPanel(2.2, 2.9, (c, w, h, s) => {
            c.fillStyle = '#fffdf6'
            c.fillRect(0, 0, w, h)
            c.strokeStyle = '#b8892b'
            c.lineWidth = 10
            c.strokeRect(w * 0.04, h * 0.03, w * 0.92, h * 0.94)
            c.strokeStyle = 'rgba(184,137,43,0.5)'
            c.lineWidth = 3
            c.strokeRect(w * 0.07, h * 0.055, w * 0.86, h * 0.89)
            text(c, "REGISTRAR'S OFFICE", w * 0.5, h * 0.12, h * 0.032, { color: '#5b6b82', weight: 700, align: 'center' })
            text(c, 'Academic Document', w * 0.5, h * 0.2, h * 0.058, { color: '#123b78', weight: 800, align: 'center' })
            text(c, 'Transcript of Records', w * 0.5, h * 0.27, h * 0.036, { color: '#0f1f38', weight: 600, align: 'center' })
            for (let i = 0; i < 8; i++) {
                c.fillStyle = 'rgba(15,31,56,0.16)'
                c.fillRect(w * 0.16, h * (0.36 + i * 0.05), w * (0.68 - (i % 3) * 0.1), h * 0.016)
            }
            if (s.seal) {
                const cx = w * 0.27
                const cy = h * 0.82
                c.fillStyle = '#c99a2e'
                c.beginPath()
                for (let k = 0; k < 24; k++) {
                    const r = k % 2 ? h * 0.06 : h * 0.07
                    const a = (k / 24) * Math.PI * 2
                    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
                }
                c.fill()
                c.fillStyle = '#e6b54a'
                c.beginPath()
                c.arc(cx, cy, h * 0.048, 0, Math.PI * 2)
                c.fill()
                text(c, '✓', cx, cy + 2, h * 0.05, { color: '#fff', weight: 900, align: 'center' })
            }
        }, { emissive: false, transparent: false })
        const cert = makeDocument(certPanel, 2.2, 2.9)
        cert.position.set(0, 2.25, 0)
        cert.scale.setScalar(0.001)
        g.add(cert)
        const glowMat = new THREE.MeshBasicMaterial({ map: dotTex, color: COLORS.gold, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 6.2), glowMat)
        glow.position.set(0, 2.25, -0.08)
        g.add(glow)

        // Converging particles while it is generated.
        const genCount = 140
        const genGeo = new THREE.BufferGeometry()
        const genStart = new Float32Array(genCount * 3)
        const genPos = new Float32Array(genCount * 3)
        for (let i = 0; i < genCount; i++) {
            const a = Math.random() * Math.PI * 2
            const r = 2.5 + Math.random() * 3
            genStart[i * 3] = Math.cos(a) * r
            genStart[i * 3 + 1] = 0.5 + Math.random() * 4.5
            genStart[i * 3 + 2] = Math.sin(a) * r
        }
        genGeo.setAttribute('position', new THREE.BufferAttribute(genPos, 3))
        const genMat = new THREE.PointsMaterial({ size: 0.2, map: dotTex, transparent: true, opacity: 0, color: 0xffe2a0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
        g.add(new THREE.Points(genGeo, genMat))

        const genCard = canvasPanel(2.6, 0.9, (c, w, h, s) => {
            cardBackground(c, w, h, { accent: '#b8892b' })
            if (s.ready) checkMark(c, w * 0.1, h * 0.56, h * 0.16)
            text(c, s.ready ? 'Document ready' : 'Finishing the document…', w * (s.ready ? 0.2 : 0.07), h * 0.47, h * 0.15, { weight: 800 })
            text(c, 'Transcript of Records · REQ-000124', w * (s.ready ? 0.2 : 0.07), h * 0.72, h * 0.11, { color: '#5b6b82', weight: 600 })
        })
        genCard.mesh.position.set(2.5, 4.1, 0.6)
        genCard.mesh.rotation.y = -0.25
        genCard.mesh.scale.setScalar(0.001)
        g.add(genCard.mesh)

        station.generate = { group: g, pedestal, cert, certPanel, glowMat, genGeo, genStart, genPos, genMat, genCard, genCount }
    }

    // ---- 7a. Ready: the student is notified on their phone -------------------------------
    {
        const g = new THREE.Group()
        g.position.copy(at('digital'))
        world.add(g)
        const pedestal = makePedestal(1.3, COLORS.blue)
        g.add(pedestal)
        const phone = new THREE.Group()
        const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 3.0, 0.16, 4, 0.07), std(0x0f172a, { roughness: 0.25, metalness: 0.5 }))
        phone.add(body)
        const phoneScreen = canvasPanel(1.36, 2.84, (c, w, h, s) => {
            const grad = c.createLinearGradient(0, 0, 0, h)
            grad.addColorStop(0, '#16325c')
            grad.addColorStop(1, '#0b1730')
            c.fillStyle = grad
            roundRect(c, 0, 0, w, h, w * 0.12)
            c.fill()
            text(c, '9:41', w * 0.5, h * 0.05, h * 0.03, { color: '#fff', weight: 700, align: 'center' })
            text(c, 'CertiChain', w * 0.5, h * 0.2, h * 0.045, { color: '#7cc4ff', weight: 800, align: 'center' })
            if (s.notify) {
                const y = h * 0.28 * Math.min(1, s.notify) + h * 0.02
                c.fillStyle = 'rgba(255,255,255,0.95)'
                roundRect(c, w * 0.06, y, w * 0.88, h * 0.14, w * 0.06)
                c.fill()
                text(c, 'Your document is ready', w * 0.12, y + h * 0.045, h * 0.028, { color: '#0f1f38', weight: 800 })
                text(c, 'Tap to see your pickup schedule', w * 0.12, y + h * 0.09, h * 0.024, { color: '#5b6b82', weight: 600 })
            }
            if (s.card) {
                // The request on the student's phone: ready, with the pickup details.
                c.fillStyle = '#fffdf6'
                roundRect(c, w * 0.12, h * 0.46, w * 0.76, h * 0.32, 10)
                c.fill()
                text(c, 'REQ-000124', w * 0.18, h * 0.5, h * 0.024, { color: '#5b6b82', weight: 700 })
                text(c, 'Transcript of Records', w * 0.18, h * 0.55, h * 0.03, { color: '#0f1f38', weight: 800 })
                c.fillStyle = 'rgba(34,197,94,0.15)'
                roundRect(c, w * 0.18, h * 0.585, w * 0.5, h * 0.045, h * 0.022)
                c.fill()
                text(c, '● Ready for pickup', w * 0.21, h * 0.608, h * 0.024, { color: '#15803d', weight: 800 })
                text(c, 'Thu, Oct 8 · 9:00 AM', w * 0.18, h * 0.68, h * 0.026, { color: '#0f1f38', weight: 700 })
                text(c, "Registrar's Office", w * 0.18, h * 0.725, h * 0.022, { color: '#5b6b82', weight: 600 })
                c.fillStyle = s.opened ? '#22c55e' : s.pressed ? '#1d4ed8' : '#3b82f6'
                roundRect(c, w * 0.16, h * 0.81, w * 0.68, h * 0.075, h * 0.037)
                c.fill()
                text(c, s.opened ? 'Got it ✓' : 'View Pickup Schedule', w * 0.5, h * 0.848, h * 0.026, { color: '#fff', weight: 800, align: 'center' })
            }
        })
        phoneScreen.mesh.position.z = 0.085
        phone.add(phoneScreen.mesh)
        phone.position.set(0, 2.2, 0)
        phone.rotation.x = -0.08
        g.add(shadowed(phone))
        const student = makePerson({ top: COLORS.navy, bottom: 0x334155, hair: 0x2a1a12 })
        student.position.set(-2.5, 0, 0.3)
        student.rotation.y = 1.1
        g.add(student)
        station.digital = { group: g, phone, phoneScreen, pedestal, student }
    }

    // ---- 7b. Pickup: calendar board + registrar window ---------------
    {
        const g = new THREE.Group()
        g.position.copy(at('physical'))
        world.add(g)
        const board = new THREE.Group()
        const frame = new THREE.Mesh(new RoundedBoxGeometry(3.4, 2.8, 0.14, 3, 0.08), std(0xdfe6f1, { roughness: 0.4 }))
        board.add(frame)
        const cal = canvasPanel(3.2, 2.6, (c, w, h, s) => {
            c.fillStyle = '#ffffff'
            c.fillRect(0, 0, w, h)
            c.fillStyle = '#123b78'
            c.fillRect(0, 0, w, h * 0.15)
            text(c, 'October 2026', w * 0.06, h * 0.075, h * 0.07, { color: '#fff', weight: 800 })
            text(c, 'Claiming schedule', w * 0.94, h * 0.075, h * 0.05, { color: '#bfe3ff', weight: 700, align: 'right' })
            const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
            const cw = (w * 0.9) / 7
            days.forEach((d, i) => text(c, d, w * 0.05 + cw * (i + 0.5), h * 0.21, h * 0.045, { color: '#5b6b82', weight: 700, align: 'center' }))
            // Oct 1, 2026 is a Thursday.
            const offset = 4
            for (let day = 1; day <= 31; day++) {
                const idx = day + offset - 1
                const col = idx % 7
                const row = Math.floor(idx / 7)
                const cx = w * 0.05 + cw * (col + 0.5)
                const cy = h * (0.3 + row * 0.13)
                const pick = day === 8
                if (pick && s.pick) {
                    c.fillStyle = `rgba(59,130,246,${0.25 + 0.75 * Math.min(1, s.pick)})`
                    c.beginPath()
                    c.arc(cx, cy, h * 0.058, 0, Math.PI * 2)
                    c.fill()
                }
                const weekend = col === 0 || col === 6
                text(c, String(day), cx, cy, h * 0.048, { color: pick && s.pick ? '#fff' : weekend ? '#a3b1c4' : '#0f1f38', weight: pick ? 800 : 600, align: 'center' })
            }
        })
        cal.mesh.position.z = 0.075
        board.add(cal.mesh)
        board.position.set(-1.2, 2.5, 0)
        board.rotation.y = 0.2
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 10), std(0x6b7280, { metalness: 0.6 }))
        stand.position.set(-1.2, 0.6, -0.1)
        g.add(shadowed(stand))
        g.add(shadowed(board))

        // Registrar window.
        const booth = new THREE.Group()
        const wall = new THREE.Mesh(new RoundedBoxGeometry(3.2, 3.0, 0.4, 3, 0.08), std(0xe9edf4, { roughness: 0.5 }))
        wall.position.y = 1.5
        booth.add(wall)
        const windowCut = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ color: 0x9cc8f0, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.6 }))
        windowCut.position.set(0, 1.75, 0.21)
        booth.add(windowCut)
        const counter = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.12, 0.6, 2, 0.04), std(COLORS.desk))
        counter.position.set(0, 1.15, 0.45)
        booth.add(counter)
        const sign = canvasPanel(2.6, 0.5, (c, w, h) => {
            c.fillStyle = '#123b78'
            roundRect(c, 0, 0, w, h, h * 0.2)
            c.fill()
            text(c, "REGISTRAR'S OFFICE · CLAIMING", w / 2, h / 2 + 1, h * 0.3, { color: '#fff', weight: 800, align: 'center' })
        })
        sign.mesh.position.set(0, 2.75, 0.22)
        booth.add(sign.mesh)
        booth.position.set(2.6, 0, -0.8)
        booth.rotation.y = -0.35
        g.add(shadowed(booth))

        const slot = canvasPanel(2.7, 1.0, (c, w, h, s) => {
            cardBackground(c, w, h, { accent: '#123b78' })
            if (s.confirmed) checkMark(c, w * 0.1, h * 0.56, h * 0.16)
            text(c, 'Thu, October 8 · 9:00 AM', w * (s.confirmed ? 0.2 : 0.07), h * 0.47, h * 0.15, { weight: 800 })
            text(c, 'Bring a valid ID + Official Receipt', w * (s.confirmed ? 0.2 : 0.07), h * 0.73, h * 0.11, { color: '#5b6b82', weight: 600 })
        })
        slot.mesh.position.set(-1.0, 4.55, 0.5)
        slot.mesh.scale.setScalar(0.001)
        g.add(slot.mesh)
        const student = makePerson({ top: COLORS.navy, bottom: 0x334155, hair: 0x2a1a12 })
        student.position.set(1.6, 0, 1.6)
        student.rotation.y = Math.PI + 0.5
        g.add(student)
        station.physical = { group: g, cal, slot, student }
    }

    // ---- 8. Completion: completed panel + request history -----------------------
    {
        const g = new THREE.Group()
        g.position.copy(at('complete'))
        world.add(g)
        const done = canvasPanel(5.4, 1.7, (c, w, h, s) => {
            const r = h * 0.14
            roundRect(c, 6, 6, w - 12, h - 12, r)
            const grad = c.createLinearGradient(0, 0, w, h)
            grad.addColorStop(0, '#0f3d2b')
            grad.addColorStop(1, '#14532d')
            c.fillStyle = grad
            c.fill()
            c.lineWidth = 6
            c.strokeStyle = 'rgba(134,239,172,0.9)'
            c.stroke()
            checkMark(c, h * 0.5, h * 0.5, h * 0.27, '#22c55e')
            text(c, 'REQUEST COMPLETED', h * 0.92, h * 0.42, h * 0.18, { color: '#ffffff', weight: 900 })
            text(c, s.sub || 'Document released · REQ-000124', h * 0.9, h * 0.68, h * 0.11, { color: '#bbf7d0', weight: 600 })
        })
        done.mesh.position.set(0, 3.6, 0.6)
        done.mesh.scale.setScalar(0.001)
        g.add(done.mesh)
        const logCard = canvasPanel(2.6, 1.6, (c, w, h, s) => {
            cardBackground(c, w, h, { accent: '#123b78' })
            cardTitle(c, w, h, 'Request history')
            const rows = ['Request submitted', 'Payment verified', 'Document prepared', 'Released at the window', 'Marked completed']
            rows.forEach((label, i) => {
                if (i >= (s.rows || 0)) return
                const y = h * (0.26 + i * 0.14)
                checkMark(c, w * 0.09, y, h * 0.04)
                text(c, label, w * 0.17, y, h * 0.07, { color: '#0f1f38', weight: 700 })
            })
        })
        logCard.mesh.position.set(3.6, 2.6, 2.4)
        logCard.mesh.rotation.y = -0.45
        logCard.mesh.scale.setScalar(0.001)
        g.add(logCard.mesh)
        station.complete = { group: g, done, logCard }
    }

    // Badges.
    const badgeInfo = [
        ['request', 1, 'Student Request'],
        ['upload', 2, 'Requirements'],
        ['payment', 3, 'Payment & Receipt'],
        ['record', 4, 'Registrar Review'],
        ['process', 5, 'Processing'],
        ['generate', 6, 'Document Ready'],
        ['digital', 7, 'Student Notified'],
        ['physical', 7, 'Pickup'],
        ['complete', 8, 'Completed'],
    ]
    for (const [k, n, label] of badgeInfo) {
        const b = makeBadge(n, label)
        b.mesh.position.copy(at(k, 6.4))
        world.add(b.mesh)
        badges[k] = b
    }

    // ---- Shot state + animation ------------------------------------------------
    const tmp = new THREE.Vector3()
    const camPos = new THREE.Vector3()
    const camTarget = new THREE.Vector3()
    const fromPos = new THREE.Vector3()
    const fromTarget = new THREE.Vector3()
    const toPos = new THREE.Vector3()
    const toTarget = new THREE.Vector3()
    let camT = 1
    let shotId = 'intro'
    let shotTime = 0
    let paused = false
    let pathFillTarget = 0
    let pathFillNow = 0
    const BADGE_FOR_SHOT = { request: 'request', upload: 'upload', payment: 'payment', record: 'record', process: 'process', generate: 'generate', digital: 'digital', physical: 'physical', complete: 'complete' }
    const SHOT_ORDER = ['intro', 'request', 'upload', 'payment', 'record', 'process', 'generate', 'digital', 'physical', 'complete', 'finale']

    const framing = (id) => {
        const f = CAMERA[id] || CAMERA.intro
        const target = new THREE.Vector3(...f.target)
        return { target, pos: target.clone().add(new THREE.Vector3(...f.offset)) }
    }
    {
        const f = framing('intro')
        camPos.copy(f.pos).add(new THREE.Vector3(-10, 12, 14))
        camTarget.copy(f.target)
        fromPos.copy(camPos)
        fromTarget.copy(camTarget)
        toPos.copy(f.pos)
        toTarget.copy(f.target)
        camT = 0
    }

    const fillForShot = (id) => {
        const k = BADGE_FOR_SHOT[id]
        if (id === 'finale') return 1
        if (!k) return 0
        return stationU[order.indexOf(k)]
    }

    function resetStations() {
        const r = station.request
        r.card.mesh.scale.setScalar(0.001)
        r.card.redraw({})
        r.screen.redraw({})
        r.token.visible = false
        const u = station.upload
        u.docs.forEach((d) => d.position.copy(d.userData.start))
        u.progress.mesh.scale.setScalar(0.001)
        u.beamMat.opacity = 0
        const pay = station.payment
        pay.receipt.position.copy(pay.receipt.userData.start)
        pay.receipt.scale.setScalar(0.001)
        pay.card.mesh.scale.setScalar(0.001)
        pay.card.redraw({})
        pay.student.position.copy(pay.student.userData.start)
        const rc = station.record
        rc.record.mesh.scale.setScalar(0.001)
        const p = station.process
        p.checklist.mesh.scale.setScalar(0.001)
        p.doc.position.copy(p.doc.userData.start)
        const gnr = station.generate
        gnr.genCard.mesh.scale.setScalar(0.001)
        const d = station.digital
        d.phoneScreen.redraw({})
        const ph = station.physical
        ph.slot.mesh.scale.setScalar(0.001)
        ph.cal.redraw({})
        const c = station.complete
        c.done.mesh.scale.setScalar(0.001)
        c.logCard.mesh.scale.setScalar(0.001)
    }

    // The certificate stays generated for every shot after 'generate'.
    function settleBefore(id) {
        const idx = SHOT_ORDER.indexOf(id)
        const gIdx = SHOT_ORDER.indexOf('generate')
        const gnr = station.generate
        if (idx > gIdx) {
            gnr.cert.scale.setScalar(1)
            gnr.certPanel.redraw({ seal: true })
        } else if (idx < gIdx) {
            gnr.cert.scale.setScalar(0.001)
            gnr.certPanel.redraw({})
        }
        if (id === 'finale') {
            station.complete.done.mesh.scale.setScalar(1.15)
        }
    }

    function setShot(id, { instant = false } = {}) {
        shotId = id
        shotTime = 0
        resetStations()
        settleBefore(id)
        const f = framing(id)
        fromPos.copy(camPos)
        fromTarget.copy(camTarget)
        toPos.copy(f.pos)
        toTarget.copy(f.target)
        camT = instant ? 1 : 0
        if (instant) {
            camPos.copy(toPos)
            camTarget.copy(toTarget)
        }
        pathFillTarget = fillForShot(id)
        const activeBadge = BADGE_FOR_SHOT[id]
        const activeIdx = activeBadge ? order.indexOf(activeBadge) : id === 'finale' ? order.length : -1
        order.forEach((k, i) => badges[k].redraw({ active: k === activeBadge, done: i < activeIdx }))
        if (activeBadge) {
            focus.target.position.copy(at(activeBadge, 1))
            focus.position.copy(at(activeBadge, 14)).add(new THREE.Vector3(-3, 0, 5))
        }
    }

    const scaleTo = (mesh, x, s = 1) => mesh.scale.setScalar(Math.max(0.001, popIn(x) * s))

    function animateShot(t) {
        if (shotId === 'request') {
            const r = station.request
            r.screen.redraw({ filled: Math.floor(span(t, 0.8, 2.4) * 3.99), pressed: t > 4.6 })
            scaleTo(r.card.mesh, span(t, 2.2, 3.1))
            r.card.mesh.position.y = 2.6 + span(t, 2.2, 3.4) * 0.5
            r.card.redraw({ pressed: t > 4.6 })
            if (t > 5.3) {
                const k = span(t, 5.3, 7.6)
                scaleTo(r.card.mesh, 1 - span(t, 5.2, 5.7))
                r.token.visible = k < 1
                const u = easeInOut(k) * stationU[1]
                curve.getPointAt(u, tmp)
                r.token.position.set(tmp.x, 1.2 + Math.sin(k * Math.PI) * 1.4, tmp.z)
                r.token.rotation.y = t * 3
            }
            // student leans in to type
            r.student.userData.arms.forEach((a, i) => { a.rotation.x = -0.9 + Math.sin(t * 9 + i * 2) * (t < 4.6 ? 0.06 : 0) })
        } else if (shotId === 'upload') {
            const u = station.upload
            u.beamMat.opacity = 0.16 * span(t, 1.0, 2.0) * (0.85 + Math.sin(t * 4) * 0.15)
            u.docs.forEach((d, i) => {
                const k = easeInOut(span(t, 1.4 + i * 0.6, 3.4 + i * 0.6))
                d.position.lerpVectors(d.userData.start, d.userData.end, k)
                d.position.y += Math.sin(k * Math.PI) * 0.9 + (k >= 1 ? Math.sin(t * 2 + i) * 0.05 : 0)
                d.rotation.y = (1 - k) * 0.8
            })
            scaleTo(u.progress.mesh, span(t, 2.0, 2.8))
            u.progress.redraw({ p: Math.round(span(t, 2.2, 6.2) * 50) / 50 })
            u.pedestal.userData.ringMat.opacity = 0.5 + Math.sin(t * 5) * 0.3
            u.student.userData.arms[1].rotation.x = -1.1 * span(t, 0.8, 1.6) * (1 - span(t, 4.6, 5.4))
        } else if (shotId === 'payment') {
            const pay = station.payment
            // Walk up to the cashier window.
            const walk = easeInOut(span(t, 0.3, 1.5))
            pay.student.position.lerpVectors(pay.student.userData.start, pay.student.userData.end, walk)
            pay.student.userData.body.position.y = 1.05 + (walk > 0 && walk < 1 ? Math.abs(Math.sin(t * 7)) * 0.04 : 0)
            // The cashier hands over the Official Receipt...
            scaleTo(pay.receipt, span(t, 1.6, 2.1))
            const hand = easeInOut(span(t, 1.9, 3.0))
            pay.receipt.position.lerpVectors(pay.receipt.userData.start, pay.receipt.userData.hand, hand)
            pay.receipt.position.y += Math.sin(hand * Math.PI) * 0.4
            pay.receipt.rotation.y = 0.6 * (1 - hand)
            pay.student.userData.arms[1].rotation.x = -1.1 * span(t, 2.4, 3.0) * (1 - span(t, 4.6, 5.2))
            // ...and the student uploads a photo of it.
            scaleTo(pay.card.mesh, span(t, 3.2, 4.0))
            pay.card.mesh.position.y = 4.3 + Math.sin(t * 1.6) * 0.05
            const up = easeInOut(span(t, 4.6, 6.0))
            if (up > 0) {
                pay.receipt.position.lerpVectors(pay.receipt.userData.hand, pay.receipt.userData.up, up)
                scaleTo(pay.receipt, 1 - span(t, 5.6, 6.2))
            }
            pay.card.redraw({ p: Math.round(span(t, 4.6, 7.2) * 50) / 50, done: t > 7.4 })
            if (t > 7.4 && t < 7.5) sparkle(at('payment').x - 0.6, 4.3, at('payment').z + 0.8, 0xffe2a0)
        } else if (shotId === 'record') {
            const rc = station.record
            const rows = Math.floor(span(t, 2.3, 4.9) * 4.99)
            rc.screen.redraw({ rows: Math.floor(span(t, 1.6, 4.9) * 6.99) })
            scaleTo(rc.record.mesh, span(t, 1.8, 2.6))
            rc.record.redraw({ rows, verified: t > 6.2 })
            if (t > 6.2 && t < 6.3) sparkle(at('record').x + 0.2, 3.3, at('record').z + 0.7, 0x86efac)
            rc.employee.userData.arms.forEach((a, i) => { a.rotation.x = -0.95 + Math.sin(t * 8 + i * 1.7) * 0.05 })
            rc.employee.userData.head.rotation.y = t > 1.8 && t < 6 ? 0.35 : 0
        } else if (shotId === 'process') {
            const p = station.process
            scaleTo(p.checklist.mesh, span(t, 1.2, 2.0))
            p.checklist.redraw({ done: Math.floor(span(t, 1.9, 5.1) * 4.99) })
            p.screen.redraw({ p: Math.round(span(t, 1.0, 5.6) * 40) / 40 })
            const k = easeInOut(span(t, 5.6, 6.8))
            p.doc.position.lerpVectors(p.doc.userData.start, p.doc.userData.end, k)
            p.doc.position.y += Math.sin(k * Math.PI) * 0.5
            p.employee.userData.arms.forEach((a, i) => { a.rotation.x = -0.95 + Math.sin(t * 8 + i * 1.7) * 0.05 })
        } else if (shotId === 'generate') {
            const gnr = station.generate
            const k = span(t, 1.4, 4.2)
            gnr.genMat.opacity = k > 0 && k < 1 ? 0.9 : Math.max(0, gnr.genMat.opacity - 0.03)
            for (let i = 0; i < gnr.genCount; i++) {
                const e = easeInOut(Math.min(1, k * (1 + (i % 7) * 0.05)))
                gnr.genPos[i * 3] = gnr.genStart[i * 3] * (1 - e)
                gnr.genPos[i * 3 + 1] = gnr.genStart[i * 3 + 1] * (1 - e) + 2.25 * e
                gnr.genPos[i * 3 + 2] = gnr.genStart[i * 3 + 2] * (1 - e)
            }
            gnr.genGeo.attributes.position.needsUpdate = true
            const c = easeOut(span(t, 3.0, 4.4))
            gnr.cert.scale.set(Math.max(0.001, c), Math.max(0.001, c), 1)
            gnr.cert.rotation.y = (1 - c) * Math.PI * 0.6 + Math.sin(t * 0.8) * 0.06
            gnr.glowMat.opacity = 0.7 * span(t, 3.0, 4.2) * (1 - span(t, 5.5, 7.5)) + 0.12
            gnr.certPanel.redraw({ seal: t > 4.6 })
            if (t > 4.6 && t < 4.7) sparkle(at('generate').x - 0.5, 1.8, at('generate').z + 0.3, 0xffe2a0)
            scaleTo(gnr.genCard.mesh, span(t, 4.8, 5.6))
            gnr.genCard.redraw({ ready: t > 4.8 })
            gnr.pedestal.userData.ringMat.opacity = 0.5 + Math.sin(t * 5) * 0.3
        } else if (shotId === 'digital') {
            const d = station.digital
            d.phone.rotation.y = Math.sin(t * 0.6) * 0.12
            d.phone.position.y = 2.2 + Math.sin(t * 1.4) * 0.06
            d.phoneScreen.redraw({
                notify: Math.round(span(t, 1.5, 2.1) * 20) / 20,
                card: t > 3.0,
                pressed: t > 4.4,
                opened: t > 6.6,
            })
            if (t > 6.6 && t < 6.7) sparkle(at('digital').x, 2.0, at('digital').z + 0.5, 0x93c5fd)
            d.student.userData.head.rotation.x = 0.15
            d.pedestal.userData.ringMat.opacity = 0.5 + Math.sin(t * 5) * 0.3
        } else if (shotId === 'physical') {
            const ph = station.physical
            ph.cal.redraw({ pick: Math.round(span(t, 2.0, 2.6) * 10) / 10 })
            scaleTo(ph.slot.mesh, span(t, 3.0, 3.8))
            ph.slot.mesh.position.y = 4.55 + Math.sin(t * 1.6) * 0.05
            ph.slot.redraw({ confirmed: t > 5.2 })
            if (t > 5.2 && t < 5.3) sparkle(at('physical').x - 1.0, 4.2, at('physical').z + 0.5, 0x93c5fd)
            // student walks towards the window
            const w = easeInOut(span(t, 3.6, 7.2))
            ph.student.position.set(1.6 + w * 0.9, 0, 1.6 - w * 1.3)
            ph.student.userData.body.position.y = 1.05 + (w > 0 && w < 1 ? Math.abs(Math.sin(t * 7)) * 0.04 : 0)
        } else if (shotId === 'complete') {
            const c = station.complete
            scaleTo(c.logCard.mesh, span(t, 0.9, 1.6))
            c.logCard.redraw({ rows: Math.floor(span(t, 1.1, 4.0) * 5.99) })
            scaleTo(c.done.mesh, span(t, 5.0, 5.8), 1.15)
            c.done.mesh.position.y = 3.6 + Math.sin(t * 1.5) * 0.05
            if (t > 5.0 && t < 5.1) sparkle(at('complete').x, 3.6, at('complete').z + 0.8, 0x86efac)
        } else if (shotId === 'finale') {
            station.complete.done.mesh.position.y = 3.6 + Math.sin(t * 1.5) * 0.05
        }
    }

    function idle(time) {
        // Breathing + gentle head motion for everyone.
        const people = [station.request.student, station.upload.student, station.payment.student, station.payment.cashier, station.record.employee, station.process.employee, station.digital.student, station.physical.student]
        people.forEach((p, i) => {
            const b = p.userData.body
            b.scale.y = 1 + Math.sin(time * 1.6 + i) * 0.012
            if (!(shotId === 'record' && p === station.record.employee)) p.userData.head.rotation.y = Math.sin(time * 0.4 + i * 1.3) * 0.12
        })
        // Path pulses.
        pulses.forEach((m) => {
            m.userData.u = (m.userData.u + 0.0016) % 1
            curve.getPointAt(m.userData.u, tmp)
            m.position.set(tmp.x, 0.1, tmp.z)
            const lit = m.userData.u <= pathFillNow + 0.001
            m.material.opacity = lit ? 0.95 : 0.35
            m.scale.setScalar(lit ? 1.2 : 0.8)
        })
        // Ambient particles drift upward.
        const arr = particleGeo.attributes.position.array
        for (let i = 0; i < particleCount; i++) {
            arr[i * 3 + 1] += speeds[i] * 0.012
            if (arr[i * 3 + 1] > 16) arr[i * 3 + 1] = 0
        }
        particleGeo.attributes.position.needsUpdate = true
        // Badges face the camera; only on the wide overview shots (a map).
        const showBadges = shotId === 'intro' || shotId === 'finale'
        Object.values(badges).forEach((b) => {
            b.mesh.visible = showBadges
            b.mesh.quaternion.copy(camera.quaternion)
        })
    }

    // ---- Loop -------------------------------------------------------------------
    const clock = new THREE.Clock()
    let elapsed = 0
    let frame = 0
    const loop = () => {
        frame = requestAnimationFrame(loop)
        // Real time (capped) so slow computers stay in step with the narrator.
        const dt = Math.min(0.25, clock.getDelta())
        if (!paused) {
            shotTime += dt
            elapsed += dt
        }

        // Camera glide with a slow drift once it arrives.
        if (camT < 1 && !paused) camT = Math.min(1, camT + dt / 2.6)
        const e = easeInOut(camT)
        const drift = paused ? 0 : Math.sin(elapsed * 0.25) * 0.6
        camPos.lerpVectors(fromPos, toPos, e)
        camTarget.lerpVectors(fromTarget, toTarget, e)
        // Arc the camera up a little while travelling.
        camPos.y += Math.sin(e * Math.PI) * 2.5
        camera.position.set(camPos.x + drift, camPos.y + drift * 0.3, camPos.z)
        camera.lookAt(camTarget)

        if (shotId === 'finale' && camT >= 1) {
            const a = shotTime * 0.06
            const f = framing('finale')
            const off = f.pos.clone().sub(f.target)
            const r = Math.hypot(off.x, off.z)
            camera.position.set(f.target.x + Math.cos(a + Math.atan2(off.z, off.x)) * r, f.pos.y, f.target.z + Math.sin(a + Math.atan2(off.z, off.x)) * r)
            camera.lookAt(f.target)
        }

        // Fill the path up to the active station.
        pathFillNow += (pathFillTarget - pathFillNow) * Math.min(1, dt * 1.6)
        fillGeo.setDrawRange(0, Math.floor((fillIndexCount * pathFillNow) / 6) * 6)

        // Spotlight on the active station.
        const wantFocus = BADGE_FOR_SHOT[shotId] ? 60 : 0
        focus.intensity += (wantFocus - focus.intensity) * Math.min(1, dt * 2)

        if (!paused) animateShot(shotTime)
        idle(elapsed)

        // Sparkles.
        if (burstAge < 2) {
            burstAge += dt
            for (let i = 0; i < burstCount; i++) {
                burstPos[i * 3] += burstVel[i * 3] * dt
                burstPos[i * 3 + 1] += burstVel[i * 3 + 1] * dt
                burstPos[i * 3 + 2] += burstVel[i * 3 + 2] * dt
                burstVel[i * 3 + 1] -= 2.2 * dt
            }
            burstGeo.attributes.position.needsUpdate = true
            burstMat.opacity = Math.max(0, 1 - burstAge / 1.6)
        }

        renderer.render(scene, camera)
    }

    const resize = () => {
        const w = container.clientWidth || 1
        const h = container.clientHeight || 1
        renderer.setSize(w, h, false)
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'
        camera.aspect = w / h
        // Keep the framing on tall (phone) screens.
        camera.fov = w / h < 1 ? 52 : 34
        // Frame the action in the upper part of the screen, clear of the
        // subtitles at the bottom.
        camera.setViewOffset(w, h, 0, Math.round(h * 0.14), w, h)
        camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()
    setShot('intro')
    loop()

    return {
        setShot,
        setPaused(value) { paused = value },
        dispose() {
            cancelAnimationFrame(frame)
            ro.disconnect()
            scene.traverse((o) => {
                if (o.geometry) o.geometry.dispose()
                if (o.material) {
                    const mats = Array.isArray(o.material) ? o.material : [o.material]
                    mats.forEach((m) => {
                        if (m.map) m.map.dispose()
                        m.dispose()
                    })
                }
            })
            envTexture.dispose()
            pmrem.dispose()
            renderer.dispose()
            renderer.domElement.remove()
        },
    }
}
