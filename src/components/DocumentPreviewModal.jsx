import { useEffect, useRef, useState } from 'react'
import { IconX } from './UiIcons'
import { useScrollLock } from '../lib/useScrollLock'
import './DocumentPreviewModal.css'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

function getExtension(nameOrUrl) {
    if (!nameOrUrl) return ''
    const clean = nameOrUrl.split('?')[0]
    return clean.split('.').pop().toLowerCase()
}

function DocumentPreviewModal({ url, fileName, onClose }) {
    useScrollLock(Boolean(url))

    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const draggingRef = useRef(false)
    const lastPointRef = useRef({ x: 0, y: 0 })

    useEffect(() => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }, [url])

    if (!url) return null

    const extension = getExtension(url) || getExtension(fileName)
    const isImage = IMAGE_EXTENSIONS.includes(extension)
    const isPdf = extension === 'pdf'

    const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100))
    const zoomOut = () => setZoom((z) => {
        const next = Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100)
        if (next <= 1) setPan({ x: 0, y: 0 })
        return next
    })
    const resetZoom = () => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }

    const handleWheel = (e) => {
        if (!isImage) return
        e.preventDefault()
        if (e.deltaY < 0) zoomIn()
        else zoomOut()
    }

    const handleMouseDown = (e) => {
        if (zoom <= 1) return
        draggingRef.current = true
        setIsDragging(true)
        lastPointRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseMove = (e) => {
        if (!draggingRef.current) return
        const dx = e.clientX - lastPointRef.current.x
        const dy = e.clientY - lastPointRef.current.y
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
        lastPointRef.current = { x: e.clientX, y: e.clientY }
    }

    const stopDragging = () => {
        draggingRef.current = false
        setIsDragging(false)
    }

    return (
        <div className="doc-preview-backdrop">
            <div className="doc-preview-card">
                <div className="doc-preview-header">
                    <span className="doc-preview-title">{fileName || 'Document'}</span>

                    {isImage && (
                        <div className="doc-preview-zoom-controls">
                            <button
                                type="button"
                                className="doc-preview-zoom-button"
                                onClick={zoomOut}
                                disabled={zoom <= MIN_ZOOM}
                                aria-label="Zoom out"
                            >
                                −
                            </button>
                            <button
                                type="button"
                                className="doc-preview-zoom-label"
                                onClick={resetZoom}
                                title="Reset zoom"
                            >
                                {Math.round(zoom * 100)}%
                            </button>
                            <button
                                type="button"
                                className="doc-preview-zoom-button"
                                onClick={zoomIn}
                                disabled={zoom >= MAX_ZOOM}
                                aria-label="Zoom in"
                            >
                                +
                            </button>
                        </div>
                    )}

                    <button className="doc-preview-close" onClick={onClose} aria-label="Close">
                        <IconX />
                    </button>
                </div>

                <div
                    className="doc-preview-body"
                    onWheel={handleWheel}
                    onMouseMove={handleMouseMove}
                    onMouseUp={stopDragging}
                    onMouseLeave={stopDragging}
                >
                    {isImage ? (
                        <img
                            src={url}
                            alt={fileName || 'Document preview'}
                            draggable={false}
                            onMouseDown={handleMouseDown}
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                            }}
                        />
                    ) : isPdf ? (
                        <iframe src={url} title={fileName || 'Document preview'} />
                    ) : (
                        <div className="doc-preview-unsupported">
                            <p>This file type can't be previewed here.</p>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="doc-preview-fallback-link">
                                Open file →
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default DocumentPreviewModal
