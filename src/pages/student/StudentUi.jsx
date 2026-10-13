import { useEffect, useId, useMemo, useRef, useState } from 'react'
export { EmptyState } from '../../components/EmptyState'

const friendlyTypes = (accept) => {
    if (!accept) return 'JPG, PNG, PDF'
    const names = accept.split(',').map((t) => t.trim().toLowerCase()).map((t) => {
        if (t.includes('pdf')) return 'PDF'
        if (t.includes('png')) return 'PNG'
        if (t.includes('jpeg') || t.includes('jpg')) return 'JPG'
        if (t.includes('webp')) return 'WEBP'
        if (t === 'image/*') return 'Images'
        return t.replace(/^.*\//, '').toUpperCase()
    })
    return [...new Set(names)].join(', ')
}

const sizeText = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

export function FilePicker({ file, onChange, accept, maxMb = 5, disabled = false, label = 'Upload your document' }) {
    const inputId = useId()
    const inputRef = useRef(null)
    const [dragging, setDragging] = useState(false)
    const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

    const pick = (picked) => {
        if (!picked) return
        onChange(picked)
    }

    if (file) {
        return (
            <div className="ss-file is-chosen">
                <span className="ss-file-ok" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12.5 10 17.5 19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <div className="ss-file-name">
                    <strong>{file.name}</strong>
                    <small>{sizeText(file.size)} · ready to upload</small>
                </div>
                <div className="ss-file-actions">
                    {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer">Preview</a>}
                    <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>Replace</button>
                    <button type="button" onClick={() => onChange(null)} disabled={disabled}>Remove</button>
                </div>
                <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
            </div>
        )
    }

    return (
        <label
            htmlFor={inputId}
            className={`ss-file${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) pick(e.dataTransfer.files?.[0]) }}
        >
            <span className="ss-file-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="ss-file-text">
                <strong>{label}</strong>
                <small>Tap to choose a file, or drag it here</small>
                <small>Accepted formats: {friendlyTypes(accept)} · Maximum file size: {maxMb} MB</small>
            </span>
            <input id={inputId} type="file" accept={accept} className="visually-hidden" disabled={disabled} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
        </label>
    )
}

export function TaskSteps({ steps, current = 0, label = 'How this works' }) {
    return (
        <nav className="ss-steps" aria-label={label}>
            <span className="ss-steps-title">{label}</span>
            <ol>
                {steps.map((step, i) => {
                    const state = i < current ? 'done' : i === current ? 'current' : 'next'
                    return (
                        <li key={step} className={`is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                            <span className="ss-steps-num" aria-hidden="true">
                                {state === 'done' ? (
                                    <svg viewBox="0 0 24 24" width="13" height="13"><path d="M5 12.5 10 17.5 19 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                ) : i + 1}
                            </span>
                            <span className="ss-steps-label">{step}</span>
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}

export function InfoBox({ title, children, tone = 'info' }) {
    return (
        <div className={`ss-info tone-${tone}`} role="note">
            {title && <strong>{title}</strong>}
            <div>{children}</div>
        </div>
    )
}
