import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

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

const STATIONS = {
    request: [-50, 6],
    upload: [-42, -2],
    payment: [-33, 7],
    record: [-24, -6],
    process: [-15, 2],
    generate: [-6, -5],
    hash: [3, 5],
    encrypt: [12, -4],
    chain: [22, 4],
    digital: [32, -6],
    physical: [40, 6],
    complete: [49, -4],
    verify: [58, 4],
}

const SAMPLE = {
    credential: 'CERT-2026124',
    request: 'REQ-000124',
    document: 'Transcript of Records',
    student: 'Juan Dela Cruz',
    program: 'BS Information Technology',
    fingerprint: '0x3107b80b4630c607fdaf0c39958ce51322b24270ac2ec840f4a7f072649967cb',
    edited: '0x9d41c2e07a5f3b18e6d0947c2a1fb85e33c07d6a19e4b2f8c5d1a07e6b39f412',
    encrypted: '0x01768d2c82ffe7face0944b424b89dc277e4fdd40145aebd50124dde42c1df0abfa9c51922b8b6bd85bcac20',
    block: '124',
    wallet: 'registrar identity',
    canister: 'CertiChain registry canister',
}

const HEX = '0123456789abcdef'
const scramble = (str, p, seed = 1) =>
    [...str].map((ch, i) => {
        if (ch === ' ' || ch === '·') return ch
        const r = ((i * 9301 + seed * 49297) % 233280) / 233280
        return r < p ? HEX[(i * 7 + seed * 13 + Math.floor(p * 9)) % 16] : ch
    }).join('')

const SHOT_FRAMING = {
    request: { at: 'request', y: 2.4, offset: [-7, 6.5, 12] },
    upload: { at: 'upload', y: 2.6, offset: [-6, 6, 12] },
    payment: { at: 'payment', y: 2.4, offset: [-6, 6, 12.5] },
    record: { at: 'record', y: 2.8, offset: [-7, 6.5, 12.5] },
    process: { at: 'process', y: 2.4, offset: [-6, 6.5, 12] },
    generate: { at: 'generate', y: 3, offset: [-5, 5, 12] },
    hash: { at: 'hash', y: 1.7, offset: [-6, 7.5, 15.5] },
    encrypt: { at: 'encrypt', y: 1.7, offset: [-6, 7.5, 15.5] },
    chain: { at: 'chain', y: 1.4, offset: [-7, 8, 17] },
    digital: { at: 'digital', y: 2.8, offset: [-5, 5, 11] },
    physical: { at: 'physical', y: 2.8, offset: [-6, 6, 12] },
    complete: { at: 'complete', y: 2.6, dz: -0.4, offset: [-6, 6.5, 13.5] },
    verify: { at: 'verify', y: 1.6, offset: [-6, 7, 15] },
}
const CAMERA = {
    intro: { target: [2, 0, -2], offset: [-44, 56, 78] },
    finale: { target: [2, 0, -2], offset: [-40, 60, 82] },
    ...Object.fromEntries(Object.entries(SHOT_FRAMING).map(([id, f]) => [id, {
        target: [STATIONS[f.at][0], f.y, STATIONS[f.at][1] + (f.dz || 0)],
        offset: f.offset,
    }])),
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const easeOut = (x) => 1 - Math.pow(1 - x, 3)
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const span = (t, a, b) => clamp01((t - a) / (b - a))
const popIn = (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

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
    scene.fog = new THREE.Fog(COLORS.bg, 75, 175)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTexture
    scene.environmentIntensity = 0.45

    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 400)

    scene.add(new THREE.HemisphereLight(0xbcd7ff, 0x0b1220, 0.55))
    const key = new THREE.DirectionalLight(0xfff1dc, 2.1)
    key.position.set(-20, 40, 26)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -80
    key.shadow.camera.right = 80
    key.shadow.camera.top = 40
    key.shadow.camera.bottom = -40
    key.shadow.camera.far = 140
    key.shadow.bias = -0.0004
    key.shadow.radius = 4
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x7cc4ff, 0.9)
    rim.position.set(30, 18, -30)
    scene.add(rim)

    const focus = new THREE.SpotLight(0xffffff, 0, 30, Math.PI / 7, 0.6, 1.4)
    focus.position.set(0, 16, 6)
    scene.add(focus)
    scene.add(focus.target)

    const world = new THREE.Group()
    scene.add(world)
    const platform = new THREE.Mesh(new RoundedBoxGeometry(124, 1.2, 40, 4, 0.5), std(COLORS.floor, { roughness: 0.62, metalness: 0.15 }))
    platform.position.set(4, -0.6, 0)
    platform.receiveShadow = true
    world.add(platform)
    const grid = new THREE.GridHelper(124, 62, 0x2c4a74, 0x1a3150)
    grid.position.set(4, 0.005, 0)
    grid.scale.z = 40 / 124
    grid.material.transparent = true
    grid.material.opacity = 0.35
    world.add(grid)
    const edge = new THREE.Mesh(new THREE.BoxGeometry(124.2, 0.06, 40.2), new THREE.MeshBasicMaterial({ color: COLORS.floorEdge }))
    edge.position.set(4, -1.18, 0)
    world.add(edge)

    const order = ['request', 'upload', 'payment', 'record', 'process', 'generate', 'hash', 'encrypt', 'chain', 'digital', 'physical', 'complete', 'verify']
    const pathPoints = order.map((k) => new THREE.Vector3(STATIONS[k][0], 0.06, STATIONS[k][1]))
    const curve = new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal')
    const pathMat = new THREE.MeshBasicMaterial({ color: 0x2b5a99, transparent: true, opacity: 0.75, toneMapped: false })
    const pathTube = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.05, 8, false), pathMat)
    world.add(pathTube)
    const fillGeo = new THREE.TubeGeometry(curve, 400, 0.075, 8, false)
    const fillMat = new THREE.MeshBasicMaterial({ color: COLORS.sky, transparent: true, opacity: 0.95, toneMapped: false })
    const pathFill = new THREE.Mesh(fillGeo, fillMat)
    fillGeo.setDrawRange(0, 0)
    world.add(pathFill)
    const fillIndexCount = fillGeo.index.count
    const stationU = order.map((_, i) => i / (order.length - 1))

    const pulseGeo = new THREE.SphereGeometry(0.11, 12, 10)
    const pulses = []
    for (let i = 0; i < 34; i++) {
        const m = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: COLORS.sky, transparent: true, opacity: 0.85, toneMapped: false }))
        m.userData.u = i / 34
        world.add(m)
        pulses.push(m)
    }

    const particleCount = 520
    const particleGeo = new THREE.BufferGeometry()
    const pos = new Float32Array(particleCount * 3)
    const speeds = new Float32Array(particleCount)
    for (let i = 0; i < particleCount; i++) {
        pos[i * 3] = -58 + Math.random() * 124
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
        g.add(laptop)

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

        const token = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.55, 0.06, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: COLORS.sky, emissiveIntensity: 1.3 }))
        token.visible = false
        world.add(token)

        station.request = { group: g, student, screen, card, token, laptop }
    }

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

    {
        const g = new THREE.Group()
        g.position.copy(at('payment'))
        world.add(g)

        const booth = new THREE.Group()
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
        student.rotation.y = 2.3
        g.add(student)

        station.payment = { group: g, receipt, card, student, cashier }
    }

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
            text(c, s.ready ? 'Credential generated' : 'Generating the credential…', w * (s.ready ? 0.2 : 0.07), h * 0.47, h * 0.15, { weight: 800 })
            text(c, `${SAMPLE.credential} · signed by the Registrar`, w * (s.ready ? 0.2 : 0.07), h * 0.72, h * 0.11, { color: '#5b6b82', weight: 600 })
        })
        genCard.mesh.position.set(2.5, 4.1, 0.6)
        genCard.mesh.rotation.y = -0.25
        genCard.mesh.scale.setScalar(0.001)
        g.add(genCard.mesh)

        station.generate = { group: g, pedestal, cert, certPanel, glowMat, genGeo, genStart, genPos, genMat, genCard, genCount }
    }

    {
        const g = new THREE.Group()
        g.position.copy(at('hash'))
        world.add(g)
        const pedestal = makePedestal(1.7, COLORS.sky)
        g.add(pedestal)
        const machine = new THREE.Group()
        const shell = new THREE.Mesh(new RoundedBoxGeometry(2.6, 1.7, 1.7, 4, 0.18), std(0x16325c, { roughness: 0.35, metalness: 0.45 }))
        shell.position.y = 1.15
        machine.add(shell)
        const slotMat = new THREE.MeshBasicMaterial({ color: COLORS.sky, toneMapped: false, transparent: true, opacity: 0.5 })
        const slot = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.16), slotMat)
        slot.position.set(0, 1.55, 0.86)
        machine.add(slot)
        const label = canvasPanel(2.0, 0.42, (c, w, h) => {
            c.fillStyle = '#0b1730'
            roundRect(c, 0, 0, w, h, h * 0.25)
            c.fill()
            text(c, 'SHA-256 HASHING', w / 2, h / 2 + 1, h * 0.42, { color: '#7cc4ff', weight: 800, align: 'center' })
        })
        label.mesh.position.set(0, 0.95, 0.861)
        machine.add(label.mesh)
        g.add(shadowed(machine))
        const coreMat = new THREE.MeshBasicMaterial({ color: COLORS.sky, toneMapped: false, transparent: true, opacity: 0.85 })
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), coreMat)
        core.position.y = 2.75
        g.add(core)
        const rings = [0, 1].map((i) => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78 + i * 0.22, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: i ? COLORS.gold : COLORS.sky, toneMapped: false, transparent: true, opacity: 0.8 }))
            ring.position.y = 2.75
            g.add(ring)
            return ring
        })
        const inPanel = canvasPanel(0.8, 1.05, (c, w, h) => {
            c.fillStyle = '#fffdf6'
            c.fillRect(0, 0, w, h)
            c.strokeStyle = '#b8892b'
            c.lineWidth = 6
            c.strokeRect(w * 0.05, h * 0.04, w * 0.9, h * 0.92)
            text(c, 'CREDENTIAL', w / 2, h * 0.14, h * 0.07, { color: '#123b78', weight: 800, align: 'center' })
            for (let i = 0; i < 6; i++) {
                c.fillStyle = 'rgba(15,31,56,0.18)'
                c.fillRect(w * 0.14, h * (0.28 + i * 0.1), w * (0.72 - (i % 3) * 0.12), h * 0.03)
            }
        }, { emissive: false, transparent: false })
        const inDoc = makeDocument(inPanel, 0.8, 1.05)
        inDoc.userData.start = new THREE.Vector3(-3.4, 2.4, 1.4)
        inDoc.userData.end = new THREE.Vector3(0, 1.62, 0.7)
        inDoc.position.copy(inDoc.userData.start)
        g.add(inDoc)
        const out = canvasPanel(3.8, 1.6, (c, w, h, st) => {
            cardBackground(c, w, h, { accent: '#123b78' })
            cardTitle(c, w, h, 'Fingerprint (SHA-256)')
            const shown = SAMPLE.fingerprint.slice(0, st.chars || 0)
            c.font = `700 ${Math.round(h * 0.078)}px "Consolas", "Courier New", monospace`
            c.fillStyle = '#0f1f38'
            c.textBaseline = 'middle'
            c.fillText(shown.slice(0, 34), w * 0.06, h * 0.33)
            c.fillText(shown.slice(34), w * 0.06, h * 0.46)
            text(c, 'One-way · cannot be turned back into the data', w * 0.06, h * 0.6, h * 0.055, { color: '#5b6b82', weight: 600 })
            if (st.alt) {
                c.fillStyle = 'rgba(200,16,46,0.09)'
                roundRect(c, w * 0.05, h * 0.69, w * 0.9, h * 0.24, 12)
                c.fill()
                text(c, 'If one letter of the record changes:', w * 0.08, h * 0.75, h * 0.052, { color: '#9f1239', weight: 700 })
                c.font = `700 ${Math.round(h * 0.06)}px "Consolas", "Courier New", monospace`
                c.fillStyle = '#9f1239'
                c.fillText(`${SAMPLE.edited.slice(0, 40)}…`, w * 0.08, h * 0.86)
            }
        })
        out.mesh.position.set(0.4, 4.6, 0.6)
        out.mesh.scale.setScalar(0.001)
        g.add(out.mesh)
        station.hash = { group: g, pedestal, inDoc, out, core, coreMat, rings, slotMat }
    }

    {
        const g = new THREE.Group()
        g.position.copy(at('encrypt'))
        world.add(g)
        const pedestal = makePedestal(1.6, COLORS.gold)
        g.add(pedestal)
        const lock = new THREE.Group()
        const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.2, 0.55, 4, 0.12), std(COLORS.gold, { roughness: 0.3, metalness: 0.75 }))
        body.position.y = 0.6
        lock.add(body)
        const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshBasicMaterial({ color: 0x1f2937 }))
        keyhole.position.set(0, 0.68, 0.281)
        lock.add(keyhole)
        const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.1, 12, 40, Math.PI), std(0xcbd5e1, { roughness: 0.25, metalness: 0.9 }))
        shackle.position.set(0, 1.55, 0)
        lock.add(shackle)
        lock.position.set(0, 0.35, 0)
        g.add(shadowed(lock))
        const key = new THREE.Group()
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 10, 28), std(0xe2e8f0, { metalness: 0.9, roughness: 0.25 }))
        key.add(bow)
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.05), std(0xe2e8f0, { metalness: 0.9, roughness: 0.25 }))
        blade.position.x = 0.4
        key.add(blade)
        key.userData.start = new THREE.Vector3(2.6, 2.6, 1.6)
        key.userData.end = new THREE.Vector3(0.36, 1.03, 0.45)
        key.position.copy(key.userData.start)
        key.rotation.y = Math.PI
        g.add(shadowed(key))
        const card = canvasPanel(3.6, 2.0, (c, w, h, st) => {
            const p = st.p || 0
            cardBackground(c, w, h, { accent: p >= 1 ? '#b8892b' : '#123b78' })
            cardTitle(c, w, h, p >= 1 ? 'Encrypted copy (AES-256)' : p > 0 ? 'Encrypting…' : 'Credential copy')
            if (p < 1) {
                const rows = [['Number', SAMPLE.credential], ['Document', SAMPLE.document], ['Student', SAMPLE.student], ['Program', SAMPLE.program]]
                rows.forEach(([k, v], i) => {
                    const y = h * (0.27 + i * 0.13)
                    text(c, k, w * 0.06, y, h * 0.06, { color: '#5b6b82', weight: 600 })
                    c.font = `700 ${Math.round(h * 0.064)}px ${p > 0 ? '"Consolas", monospace' : FONT}`
                    c.fillStyle = '#0f1f38'
                    c.textBaseline = 'middle'
                    c.fillText(scramble(v, p, i + 1), w * 0.32, y)
                })
            } else {
                c.font = `700 ${Math.round(h * 0.06)}px "Consolas", "Courier New", monospace`
                c.fillStyle = '#7a4d0c'
                c.textBaseline = 'middle'
                const enc = SAMPLE.encrypted
                c.fillText(enc.slice(0, 36), w * 0.06, h * 0.3)
                c.fillText(enc.slice(36, 72), w * 0.06, h * 0.41)
                c.fillText(`${enc.slice(72)}…`, w * 0.06, h * 0.52)
                text(c, 'Unreadable without the Registrar’s secret key', w * 0.06, h * 0.66, h * 0.058, { color: '#5b6b82', weight: 600 })
            }
            if (st.locked) {
                c.fillStyle = 'rgba(184,137,43,0.13)'
                roundRect(c, w * 0.05, h * 0.76, w * 0.9, h * 0.15, 12)
                c.fill()
                text(c, '🔒  Locked with the Registrar’s key', w * 0.09, h * 0.835, h * 0.064, { color: '#7a4d0c', weight: 800 })
            }
        })
        card.mesh.position.set(-0.3, 4.55, 0.7)
        card.mesh.scale.setScalar(0.001)
        g.add(card.mesh)
        station.encrypt = { group: g, pedestal, shackle, key, card }
    }

    {
        const g = new THREE.Group()
        g.position.copy(at('chain'))
        world.add(g)
        const base = new THREE.Mesh(new RoundedBoxGeometry(11, 0.25, 3.2, 3, 0.1), std(0x1a2a44, { roughness: 0.3, metalness: 0.35 }))
        base.position.y = 0.13
        g.add(shadowed(base))
        const railMat = new THREE.MeshBasicMaterial({ color: COLORS.sky, toneMapped: false, transparent: true, opacity: 0.7 })
        const rail = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.03, 0.06), railMat)
        rail.position.set(0, 0.27, 1.45)
        g.add(rail)
        const blockNumbers = ['120', '121', '122', '123', SAMPLE.block]
        const blockX = (i) => -3.8 + i * 1.9
        const blocks = blockNumbers.map((num, i) => {
            const isNew = i === blockNumbers.length - 1
            const blk = new THREE.Group()
            const glowMat = new THREE.MeshStandardMaterial({ color: isNew ? 0x1d4ed8 : 0x123b78, roughness: 0.3, metalness: 0.55, emissive: isNew ? COLORS.sky : 0x0b2a5a, emissiveIntensity: isNew ? 0.2 : 0.35 })
            const cube = new THREE.Mesh(new RoundedBoxGeometry(1.3, 1.3, 1.3, 4, 0.14), glowMat)
            blk.add(cube)
            const face = canvasPanel(1.1, 1.1, (c, w, h, st) => {
                c.fillStyle = st.lit ? 'rgba(124,196,255,0.25)' : 'rgba(255,255,255,0.06)'
                roundRect(c, 0, 0, w, h, w * 0.12)
                c.fill()
                text(c, 'RECORD', w / 2, h * 0.22, h * 0.13, { color: '#bfe3ff', weight: 800, align: 'center' })
                text(c, `#${num}`, w / 2, h * 0.42, h * 0.11, { color: '#fff', weight: 800, align: 'center' })
                for (let k = 0; k < 3; k++) {
                    c.fillStyle = isNew && st.lit ? (k === 0 ? '#7cc4ff' : '#e6b54a') : 'rgba(191,227,255,0.35)'
                    c.fillRect(w * 0.18, h * (0.6 + k * 0.1), w * (0.64 - k * 0.1), h * 0.045)
                }
            })
            face.mesh.position.z = 0.66
            blk.add(face.mesh)
            blk.position.set(blockX(i), 1.25, 0)
            blk.userData = { glowMat, face, home: new THREE.Vector3(blockX(i), 1.25, 0) }
            g.add(shadowed(blk))
            return blk
        })
        const linkMat = std(0xcbd5e1, { metalness: 0.9, roughness: 0.25 })
        const links = blocks.slice(1).map((_, i) => {
            const link = new THREE.Group()
            for (const dx of [-0.16, 0.16]) {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 10, 24), linkMat)
                ring.position.x = dx
                ring.rotation.y = dx > 0 ? Math.PI / 2 : 0
                link.add(ring)
            }
            link.position.set(blockX(i) + 0.95, 1.25, 0)
            g.add(shadowed(link))
            return link
        })
        const packets = [COLORS.sky, COLORS.gold].map((color) => {
            const m = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.42, 0.42, 2, 0.08), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.4 }))
            m.visible = false
            g.add(m)
            return m
        })
        const info = canvasPanel(3.9, 2.05, (c, w, h, st) => {
            cardBackground(c, w, h, { accent: st.permanent ? '#15803d' : '#123b78' })
            cardTitle(c, w, h, st.permanent ? 'Recorded · permanent' : 'Recording on the blockchain…')
            const rows = [
                ['Network', 'Internet Computer (ICP)'],
                ['Stored in', SAMPLE.canister],
                ['Record', `#${SAMPLE.block}`],
                ['Signed by', `HCDC ${SAMPLE.wallet}`],
                ['Stored', 'Fingerprint + encrypted copy'],
            ]
            rows.forEach(([k, v], i) => {
                if (i >= (st.rows || 0)) return
                const y = h * (0.25 + i * 0.12)
                text(c, k, w * 0.06, y, h * 0.056, { color: '#5b6b82', weight: 600 })
                text(c, v, w * 0.33, y, h * 0.058, { color: '#0f1f38', weight: 700 })
            })
            if (st.permanent) text(c, 'Nobody can change or delete it, not even the school.', w * 0.06, h * 0.88, h * 0.055, { color: '#15803d', weight: 800 })
        })
        info.mesh.position.set(0, 4.25, 1.2)
        info.mesh.scale.setScalar(0.001)
        g.add(info.mesh)
        station.chain = { group: g, blocks, links, packets, info, railMat }
    }

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
            const rows = ['Request submitted', 'Payment verified', 'Credential generated', 'Recorded on the blockchain', 'Released at the window', 'Marked completed']
            rows.forEach((label, i) => {
                if (i >= (s.rows || 0)) return
                const y = h * (0.24 + i * 0.12)
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

    {
        const g = new THREE.Group()
        g.position.copy(at('verify'))
        world.add(g)
        const pedestal = makePedestal(1.5, COLORS.green)
        g.add(pedestal)
        const screen = canvasPanel(3.4, 2.4, (c, w, h, st) => {
            c.fillStyle = '#f8fafc'
            roundRect(c, 0, 0, w, h, w * 0.03)
            c.fill()
            c.fillStyle = '#e2e8f0'
            c.fillRect(0, 0, w, h * 0.09)
            text(c, `zdn7u-5yaaa-aaaai-ayclq-cai.icp0.io/verify/${SAMPLE.credential}`, w * 0.04, h * 0.045, h * 0.04, { color: '#475569', weight: 600 })
            const bad = !!st.tamper
            const good = !bad && st.verified
            c.fillStyle = bad ? '#fde8e8' : good ? '#dcfce7' : '#e2e8f0'
            c.fillRect(0, h * 0.09, w, h * 0.16)
            text(c, bad ? '✗  Tampered — do not accept' : good ? '✓  Verified credential' : 'Checking…', w * 0.05, h * 0.17, h * 0.07, { color: bad ? '#9f1239' : good ? '#15803d' : '#475569', weight: 900 })
            const steps = bad
                ? [
                    ['Someone edited the student name in the database', 'bad'],
                    [`New fingerprint ${SAMPLE.edited.slice(0, 18)}…`, 'bad'],
                    ['Not found on the blockchain', 'bad'],
                    ['Head of Registrar alerted', 'bad'],
                ]
                : [
                    [`Found ${SAMPLE.credential} in Registrar records`, 'ok'],
                    ['Registrar’s digital signature valid', 'ok'],
                    [`Fingerprint ${SAMPLE.fingerprint.slice(0, 18)}…`, 'ok'],
                    [`Found on the Internet Computer · record #${SAMPLE.block}`, 'ok'],
                    ['Encrypted copy decrypted · matches the record', 'ok'],
                ]
            steps.forEach(([label, tone], i) => {
                if (!bad && i >= (st.steps || 0)) return
                const y = h * (0.34 + i * 0.12)
                if (tone === 'ok') checkMark(c, w * 0.07, y, h * 0.035)
                else {
                    c.fillStyle = '#e11d48'
                    c.beginPath()
                    c.arc(w * 0.07, y, h * 0.035, 0, Math.PI * 2)
                    c.fill()
                    text(c, '✗', w * 0.07, y + 1, h * 0.045, { color: '#fff', weight: 900, align: 'center' })
                }
                text(c, label, w * 0.12, y, h * 0.052, { color: tone === 'ok' ? '#0f1f38' : '#9f1239', weight: 700 })
            })
        }, { pxPerUnit: 260 })
        const monitor = new THREE.Group()
        const frame = new THREE.Mesh(new RoundedBoxGeometry(3.56, 2.56, 0.1, 3, 0.05), std(0x1f2937, { roughness: 0.4 }))
        monitor.add(frame)
        screen.mesh.position.z = 0.056
        monitor.add(screen.mesh)
        monitor.position.set(0, 2.55, 0)
        g.add(shadowed(monitor))
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 16), std(0x6b7280, { metalness: 0.6 }))
        pole.position.set(0, 0.85, -0.05)
        g.add(shadowed(pole))
        const employer = makePerson({ top: 0x475569, bottom: 0x1e293b, skin: COLORS.skin, hair: 0x3b2a1a })
        employer.position.set(-3.4, 0, 2.4)
        employer.rotation.y = 0.75
        g.add(employer)
        const tag = canvasPanel(2.2, 0.5, (c, w, h) => {
            c.fillStyle = 'rgba(14,30,54,0.85)'
            roundRect(c, 0, 0, w, h, h * 0.45)
            c.fill()
            text(c, 'Employer / another school', w / 2, h / 2 + 1, h * 0.3, { color: '#e2ecfa', weight: 700, align: 'center' })
        })
        tag.mesh.position.set(-3.4, 2.75, 2.4)
        g.add(tag.mesh)
        station.verify = { group: g, screen, pedestal, employer, tag }
    }

    const badgeInfo = [
        ['request', 1, 'Student Request'],
        ['upload', 2, 'Requirements'],
        ['payment', 3, 'Payment & Receipt'],
        ['record', 4, 'Registrar Review'],
        ['process', 5, 'Processing'],
        ['generate', 6, 'Credential'],
        ['hash', 7, 'Fingerprint'],
        ['encrypt', 8, 'Encrypted'],
        ['chain', 9, 'Blockchain'],
        ['digital', 10, 'Notified'],
        ['physical', 11, 'Claiming'],
        ['complete', 12, 'Completed'],
        ['verify', 13, 'Verified'],
    ]
    for (const [k, n, label] of badgeInfo) {
        const b = makeBadge(n, label)
        b.mesh.position.copy(at(k, 6.4))
        world.add(b.mesh)
        badges[k] = b
    }

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
    const BADGE_FOR_SHOT = Object.fromEntries(order.map((k) => [k, k]))
    const SHOT_ORDER = ['intro', ...order, 'finale']

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
        const hs = station.hash
        hs.inDoc.position.copy(hs.inDoc.userData.start)
        hs.inDoc.scale.setScalar(1)
        hs.out.mesh.scale.setScalar(0.001)
        hs.out.redraw({})
        const en = station.encrypt
        en.card.mesh.scale.setScalar(0.001)
        en.card.redraw({})
        en.key.position.copy(en.key.userData.start)
        en.key.visible = true
        en.shackle.position.y = 1.55
        const ch = station.chain
        ch.info.mesh.scale.setScalar(0.001)
        ch.info.redraw({})
        ch.packets.forEach((m) => { m.visible = false })
        const vf = station.verify
        vf.screen.redraw({})
    }

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
        const ch = station.chain
        const newBlock = ch.blocks[ch.blocks.length - 1]
        const lastLink = ch.links[ch.links.length - 1]
        const placed = idx > SHOT_ORDER.indexOf('chain')
        newBlock.position.copy(newBlock.userData.home)
        if (!placed) newBlock.position.y = 7
        newBlock.visible = placed
        lastLink.visible = placed
        newBlock.userData.face.redraw({ lit: placed })
        newBlock.userData.glowMat.emissiveIntensity = placed ? 0.55 : 0.2
        const en = station.encrypt
        if (idx > SHOT_ORDER.indexOf('encrypt')) {
            en.shackle.position.y = 1.25
            en.key.visible = false
        }
        if (id === 'finale') {
            station.complete.done.mesh.scale.setScalar(1.15)
            station.verify.screen.redraw({ steps: 5, verified: true })
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
            const walk = easeInOut(span(t, 0.3, 1.5))
            pay.student.position.lerpVectors(pay.student.userData.start, pay.student.userData.end, walk)
            pay.student.userData.body.position.y = 1.05 + (walk > 0 && walk < 1 ? Math.abs(Math.sin(t * 7)) * 0.04 : 0)
            scaleTo(pay.receipt, span(t, 1.6, 2.1))
            const hand = easeInOut(span(t, 1.9, 3.0))
            pay.receipt.position.lerpVectors(pay.receipt.userData.start, pay.receipt.userData.hand, hand)
            pay.receipt.position.y += Math.sin(hand * Math.PI) * 0.4
            pay.receipt.rotation.y = 0.6 * (1 - hand)
            pay.student.userData.arms[1].rotation.x = -1.1 * span(t, 2.4, 3.0) * (1 - span(t, 4.6, 5.2))
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
        } else if (shotId === 'hash') {
            const hs = station.hash
            const k = easeInOut(span(t, 1.0, 2.6))
            hs.inDoc.position.lerpVectors(hs.inDoc.userData.start, hs.inDoc.userData.end, k)
            hs.inDoc.position.y += Math.sin(k * Math.PI) * 0.8
            hs.inDoc.rotation.y = (1 - k) * 0.9
            hs.inDoc.scale.setScalar(Math.max(0.001, 1 - span(t, 2.4, 2.8)))
            const spin = span(t, 2.6, 6.6)
            hs.rings.forEach((r, i) => {
                r.rotation.x = t * (1.4 + i * 0.9) * (0.3 + spin)
                r.rotation.y = t * (0.9 + i * 0.6) * (0.3 + spin)
            })
            hs.core.rotation.y = t * 2
            hs.core.scale.setScalar(1 + (spin > 0 && spin < 1 ? Math.sin(t * 12) * 0.12 : 0))
            hs.slotMat.opacity = 0.4 + (spin > 0 && spin < 1 ? Math.abs(Math.sin(t * 10)) * 0.6 : 0)
            scaleTo(hs.out.mesh, span(t, 3.0, 3.8))
            hs.out.mesh.position.y = 4.6 + Math.sin(t * 1.5) * 0.05
            hs.out.redraw({ chars: Math.round(span(t, 3.4, 6.6) * 66), alt: t > 8.0 })
            if (t > 6.8 && t < 6.9) sparkle(at('hash').x, 2.75, at('hash').z, 0x93c5fd)
            hs.pedestal.userData.ringMat.opacity = 0.5 + Math.sin(t * 5) * 0.3
        } else if (shotId === 'encrypt') {
            const en = station.encrypt
            scaleTo(en.card.mesh, span(t, 1.2, 2.0))
            en.card.mesh.position.y = 4.55 + Math.sin(t * 1.5) * 0.05
            const p = Math.round(span(t, 3.0, 6.2) * 20) / 20
            const kk = easeInOut(span(t, 5.4, 6.6))
            en.key.position.lerpVectors(en.key.userData.start, en.key.userData.end, kk)
            en.key.rotation.z = kk > 0.95 ? -Math.PI / 2 * span(t, 6.6, 7.0) : 0
            en.shackle.position.y = 1.55 - 0.3 * easeOut(span(t, 6.8, 7.2))
            en.card.redraw({ p, locked: t > 7.0 })
            if (t > 7.0 && t < 7.1) sparkle(at('encrypt').x, 1.8, at('encrypt').z + 0.4, 0xffe2a0)
            en.pedestal.userData.ringMat.opacity = 0.5 + Math.sin(t * 5) * 0.3
        } else if (shotId === 'chain') {
            const ch = station.chain
            const newBlock = ch.blocks[ch.blocks.length - 1]
            const lastLink = ch.links[ch.links.length - 1]
            const fly = span(t, 1.2, 3.4)
            ch.packets.forEach((m, i) => {
                m.visible = fly > 0 && fly < 1
                const e = easeInOut(Math.min(1, fly * (1 + i * 0.12)))
                m.position.set(-8 + e * (newBlock.userData.home.x + 8), 3.5 + Math.sin(e * Math.PI) * 1.6 - i * 0.5, 1.6 - e * 1.6)
                m.rotation.set(t * 2, t * 3, 0)
            })
            newBlock.visible = t > 2.6
            const drop = easeOut(span(t, 3.4, 5.4))
            newBlock.position.set(newBlock.userData.home.x, 7 - (7 - newBlock.userData.home.y) * drop, 0)
            newBlock.rotation.y = (1 - drop) * Math.PI
            lastLink.visible = t > 5.6
            newBlock.userData.face.redraw({ lit: t > 5.6 })
            newBlock.userData.glowMat.emissiveIntensity = t > 5.6 ? 0.55 + Math.sin(t * 4) * 0.15 : 0.2
            if (t > 5.6 && t < 5.7) sparkle(at('chain').x + newBlock.userData.home.x, 1.4, at('chain').z, 0x93c5fd)
            ch.blocks.slice(0, -1).forEach((b, i) => {
                b.userData.glowMat.emissiveIntensity = 0.3 + (t > 5.6 ? Math.max(0, Math.sin(t * 3 - i * 0.7)) * 0.25 : 0)
            })
            scaleTo(ch.info.mesh, span(t, 5.8, 6.6))
            ch.info.mesh.position.y = 4.25 + Math.sin(t * 1.5) * 0.05
            ch.info.redraw({ rows: Math.floor(span(t, 6.2, 8.4) * 5.99), permanent: t > 8.6 })
            ch.railMat.opacity = 0.5 + Math.sin(t * 4) * 0.3
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
            const w = easeInOut(span(t, 3.6, 7.2))
            ph.student.position.set(1.6 + w * 0.9, 0, 1.6 - w * 1.3)
            ph.student.userData.body.position.y = 1.05 + (w > 0 && w < 1 ? Math.abs(Math.sin(t * 7)) * 0.04 : 0)
        } else if (shotId === 'complete') {
            const c = station.complete
            scaleTo(c.logCard.mesh, span(t, 0.9, 1.6))
            c.logCard.redraw({ rows: Math.floor(span(t, 1.1, 4.4) * 6.99) })
            scaleTo(c.done.mesh, span(t, 5.0, 5.8), 1.15)
            c.done.mesh.position.y = 3.6 + Math.sin(t * 1.5) * 0.05
            if (t > 5.0 && t < 5.1) sparkle(at('complete').x, 3.6, at('complete').z + 0.8, 0x86efac)
        } else if (shotId === 'verify') {
            const vf = station.verify
            vf.screen.redraw({
                steps: Math.floor(span(t, 1.8, 5.4) * 5.99),
                verified: t > 5.6,
                tamper: t > 9.4,
            })
            if (t > 5.6 && t < 5.7) sparkle(at('verify').x, 2.6, at('verify').z + 0.4, 0x86efac)
            if (t > 9.4 && t < 9.5) sparkle(at('verify').x, 2.6, at('verify').z + 0.4, 0xfda4af)
            vf.pedestal.userData.ringMat.color.set(t > 9.4 ? 0xe11d48 : COLORS.green)
            vf.pedestal.userData.ringMat.opacity = 0.5 + Math.sin(t * 5) * 0.3
            vf.employer.userData.head.rotation.x = 0.1
            vf.tag.mesh.quaternion.copy(camera.quaternion)
        } else if (shotId === 'finale') {
            station.complete.done.mesh.position.y = 3.6 + Math.sin(t * 1.5) * 0.05
        }
    }

    function idle(time) {
        const people = [station.request.student, station.upload.student, station.payment.student, station.payment.cashier, station.record.employee, station.process.employee, station.digital.student, station.physical.student, station.verify.employer]
        people.forEach((p, i) => {
            const b = p.userData.body
            b.scale.y = 1 + Math.sin(time * 1.6 + i) * 0.012
            if (!(shotId === 'record' && p === station.record.employee)) p.userData.head.rotation.y = Math.sin(time * 0.4 + i * 1.3) * 0.12
        })
        pulses.forEach((m) => {
            m.userData.u = (m.userData.u + 0.0016) % 1
            curve.getPointAt(m.userData.u, tmp)
            m.position.set(tmp.x, 0.1, tmp.z)
            const lit = m.userData.u <= pathFillNow + 0.001
            m.material.opacity = lit ? 0.95 : 0.35
            m.scale.setScalar(lit ? 1.2 : 0.8)
        })
        const arr = particleGeo.attributes.position.array
        for (let i = 0; i < particleCount; i++) {
            arr[i * 3 + 1] += speeds[i] * 0.012
            if (arr[i * 3 + 1] > 16) arr[i * 3 + 1] = 0
        }
        particleGeo.attributes.position.needsUpdate = true
        const showBadges = shotId === 'intro' || shotId === 'finale'
        Object.values(badges).forEach((b) => {
            b.mesh.visible = showBadges
            b.mesh.quaternion.copy(camera.quaternion)
        })
    }

    const clock = new THREE.Clock()
    let elapsed = 0
    let frame = 0
    const loop = () => {
        frame = requestAnimationFrame(loop)
        const dt = Math.min(0.25, clock.getDelta())
        if (!paused) {
            shotTime += dt
            elapsed += dt
        }

        if (camT < 1 && !paused) camT = Math.min(1, camT + dt / 2.6)
        const e = easeInOut(camT)
        const drift = paused ? 0 : Math.sin(elapsed * 0.25) * 0.6
        camPos.lerpVectors(fromPos, toPos, e)
        camTarget.lerpVectors(fromTarget, toTarget, e)
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

        pathFillNow += (pathFillTarget - pathFillNow) * Math.min(1, dt * 1.6)
        fillGeo.setDrawRange(0, Math.floor((fillIndexCount * pathFillNow) / 6) * 6)

        const wantFocus = BADGE_FOR_SHOT[shotId] ? 60 : 0
        focus.intensity += (wantFocus - focus.intensity) * Math.min(1, dt * 2)

        if (!paused) animateShot(shotTime)
        idle(elapsed)

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
        camera.fov = w / h < 1 ? 52 : 34
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
