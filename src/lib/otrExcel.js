const LABELS = [
    ['name', /^name\s*:?$/],
    ['sex', /^sex\b/],
    ['birthDate', /date of birth/],
    ['birthPlace', /place of birth/],
    ['citizenship', /citizenship/],
    ['acrNo', /acr no/],
    ['address', /address/],
    ['guardian', /parent|guardian/],
    ['juniorHigh', /junior high/],
    ['seniorHigh', /senior high/],
    ['collegeOf', /^college of/],
    ['entranceData', /entrance data/],
    ['studentNumber', /student'?s? i\.?\s?d/],
    ['otrNo', /otr no/],
    ['preparedBy', /prepared by/],
]

const SCHOOL_RE = /college|university|school|institute|academy|polytechnic/i
const TERM_RE = /semester|summer|trimester|term|quarter/i
const STOP_RE = /grading system|transcript closed|hcdc hcdc|not valid without/i
const SKIP_RE = /cont'?n|continued|pls\. refer|please refer|nothing follows/i
const GRADUATED_RE = /^(graduated|completed|conferred|awarded)\b/i

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()
const norm = (v) => clean(v).toLowerCase()

function toIsoDate(cell, XLSX) {
    if (!cell) return ''
    if (cell.v instanceof Date) return isoOf(cell.v)
    if (cell.t === 'n' && cell.z && /[dmy]/i.test(cell.z)) {
        const d = XLSX.SSF.parse_date_code(cell.v)
        if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    }
    const text = clean(cell.w ?? cell.v)
    if (!text) return ''
    const parsed = new Date(text.replace(/(\d)(st|nd|rd|th)\b/, '$1'))
    if (Number.isNaN(parsed.getTime())) return ''
    let year = parsed.getFullYear()
    if (year < 1930 && /\b\d{1,2}\/\d{1,2}\/\d{2}\b/.test(text)) year += 100
    parsed.setFullYear(year)
    return isoOf(parsed)
}

function isoOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sheetGrid(ws, XLSX) {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    const at = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]
    const text = (r, c) => {
        const cell = at(r, c)
        return cell ? clean(cell.w ?? cell.v) : ''
    }
    return { range, at, text }
}

function findHeader(grid) {
    for (let r = grid.range.s.r; r <= Math.min(grid.range.e.r, 40); r++) {
        for (let c = grid.range.s.c; c <= grid.range.e.c; c++) {
            if (/term\s*&\s*course/i.test(grid.text(r, c))) return { row: r, col: c }
        }
    }
    return null
}

function courseColumns(grid, header) {
    const cols = { code: header.col, title: -1, final: -1, completion: -1, units: -1 }
    for (const r of [header.row, header.row + 1]) {
        for (let c = header.col + 1; c <= grid.range.e.c; c++) {
            const t = norm(grid.text(r, c)).replace(/\s+/g, '')
            if (cols.title < 0 && t.startsWith('descriptive')) cols.title = c
            else if (cols.final < 0 && t === 'final') cols.final = c
            else if (cols.completion < 0 && /^com-?pletion/.test(t)) cols.completion = c
            else if (cols.units < 0 && t === 'units') cols.units = c
        }
    }
    if (cols.title < 0 || cols.final < 0 || cols.units < 0) return null
    if (cols.completion < 0) cols.completion = cols.final + 1
    return cols
}

function joinRange(grid, r, from, to) {
    const parts = []
    for (let c = from; c < to; c++) {
        const t = grid.text(r, c)
        if (t) parts.push(t)
    }
    return parts.join(' ')
}

function readDetails(grid, header, XLSX) {
    const out = {}
    const lastCol = header ? header.lastCol : grid.range.e.c
    const lastRow = header ? header.row - 1 : Math.min(grid.range.e.r, 20)
    const labelAt = (r, c) => {
        const t = norm(grid.text(r, c))
        if (!t) return null
        const hit = LABELS.find(([, re]) => re.test(t))
        return hit && (t.endsWith(':') || /^acr no/.test(t)) ? hit[0] : null
    }
    for (let r = grid.range.s.r; r <= lastRow; r++) {
        for (let c = grid.range.s.c; c <= lastCol; c++) {
            const key = labelAt(r, c)
            if (!key) continue
            const values = []
            for (let k = c + 1; k <= lastCol; k++) {
                if (labelAt(r, k)) break
                const cell = grid.at(r, k)
                const t = cell ? clean(cell.w ?? cell.v) : ''
                if (t && !/^-?\s*ditto\s*-?$/i.test(t) && t !== '0') values.push({ t, cell })
            }
            if (!values.length || out[key]) continue
            if (key === 'birthDate') {
                out.birthDate = toIsoDate(values[0].cell, XLSX)
                if (!out.birthDate) out.birthDateText = values[0].t
            } else if (key === 'juniorHigh' || key === 'seniorHigh') {
                out[key] = values[0].t
                if (values[1]) out[`${key}Year`] = values[1].t
            } else {
                out[key] = values[0].t
            }
        }
    }
    return out
}

function readSignature(grid) {
    const out = {}
    for (let r = grid.range.s.r; r <= grid.range.e.r; r++) {
        for (let c = grid.range.s.c; c <= grid.range.e.c; c++) {
            const t = norm(grid.text(r, c))
            if (!/^prepared by/.test(t)) continue
            for (let k = c + 1; k <= grid.range.e.c; k++) {
                const v = grid.text(r, k)
                if (v && v !== '0') { out.preparedBy = v; break }
            }
        }
    }
    return out
}

function readCourses(grid, header, cols) {
    const rows = []
    let graduated = ''
    for (let r = header.row + 2; r <= grid.range.e.r; r++) {
        const code = joinRange(grid, r, cols.code, cols.title)
        const title = joinRange(grid, r, cols.title, cols.final)
        const final = grid.text(r, cols.final)
        const completion = cols.completion !== cols.final ? grid.text(r, cols.completion) : ''
        const units = joinRange(grid, r, cols.units, cols.units + 1)
        const whole = clean(`${code} ${title}`)
        if (STOP_RE.test(whole)) break
        if (!whole && !final && !units) continue
        if (whole === '0' && !final && !units) continue
        if (!final && !completion && !units) {
            if (SKIP_RE.test(whole)) continue
            if (GRADUATED_RE.test(whole)) {
                graduated = graduated ? `${graduated} ${whole}` : whole
                continue
            }
            if (graduated) {
                graduated = `${graduated} ${whole}`
                continue
            }
            const kind = SCHOOL_RE.test(whole) && !TERM_RE.test(whole) ? 'school' : 'term'
            rows.push({ kind, title: whole })
            continue
        }
        rows.push({ kind: 'course', code, title, final, completion, units })
    }
    return { rows, graduated }
}

function pageMarker(grid) {
    for (let r = grid.range.e.r; r >= grid.range.s.r; r--) {
        for (let c = grid.range.s.c; c <= grid.range.e.c; c++) {
            const m = grid.text(r, c).match(/page\s+(\d+)\s+of\s+(\d+)/i)
            if (m) return { page: Number(m[1]), of: Number(m[2]) }
        }
    }
    return null
}

function pickPages(sheets) {
    const firsts = sheets.filter((s) => !s.marker || s.marker.page === 1)
    const first = firsts.find((s) => s.filled) || firsts[0] || sheets[0]
    const total = first.marker ? first.marker.of : 1
    const pages = [first]
    for (let page = 2; page <= total; page++) {
        const next = sheets.find((s) => s.marker?.page === page && !pages.includes(s))
        if (next) pages.push(next)
    }
    return pages
}

export async function readOtrWorkbook(file) {
    const XLSX = await import('xlsx')
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data, { type: 'array', cellDates: true, cellFormula: false })

    const sheets = []
    for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name]
        if (!ws || !ws['!ref']) continue
        const grid = sheetGrid(ws, XLSX)
        const header = findHeader(grid)
        if (!header) continue
        const cols = courseColumns(grid, header)
        if (!cols) continue
        header.lastCol = cols.units
        const marker = pageMarker(grid)
        const filled = readCourses(grid, header, cols).rows.some((r) => r.kind === 'course')
        sheets.push({ name, grid, header, cols, marker, filled })
    }
    if (!sheets.length) {
        throw new Error('This file is not in the Registrar\'s OTR format. It needs a "Term & Course No." table with Final and Units columns.')
    }
    const pages = pickPages(sheets)

    const details = readDetails(pages[0].grid, pages[0].header, XLSX)
    const rows = []
    let graduated = ''
    let signature = {}
    for (const page of pages) {
        const result = readCourses(page.grid, page.header, page.cols)
        for (const row of result.rows) {
            const prev = rows[rows.length - 1]
            if (row.kind !== 'course' && prev && prev.kind === row.kind && norm(prev.title) === norm(row.title)) continue
            if (row.kind === 'school' && rows.some((x) => x.kind === 'school' && norm(x.title) === norm(row.title))) continue
            rows.push(row)
        }
        if (result.graduated && !graduated) graduated = result.graduated
        const sig = readSignature(page.grid)
        if (sig.preparedBy) signature = sig
    }

    return {
        details: { ...details, ...(graduated ? { graduatedText: graduated } : {}), ...signature },
        rows,
        courseCount: rows.filter((r) => r.kind === 'course').length,
    }
}
