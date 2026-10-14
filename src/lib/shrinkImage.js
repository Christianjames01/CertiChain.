const SHRINKABLE = ['image/jpeg', 'image/png', 'image/webp']

export const MAX_ORIGINAL_IMAGE_MB = 25

export const isShrinkable = (file) => !!file && SHRINKABLE.includes(file.type)

async function decode(file) {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file, { imageOrientation: 'from-image' })
        } catch {
        }
    }
    const url = URL.createObjectURL(file)
    try {
        const img = new Image()
        img.decoding = 'async'
        img.src = url
        await img.decode()
        return img
    } finally {
        URL.revokeObjectURL(url)
    }
}

export async function shrinkImage(file, { maxSide = 2000, quality = 0.82, skipBelowBytes = 350 * 1024 } = {}) {
    if (!isShrinkable(file) || file.size <= skipBelowBytes) return file

    try {
        const source = await decode(file)
        const width = source.width || source.naturalWidth
        const height = source.height || source.naturalHeight
        if (!width || !height) return file

        const scale = Math.min(1, maxSide / Math.max(width, height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(width * scale)
        canvas.height = Math.round(height * scale)

        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
        source.close?.()

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
        if (!blob || blob.size >= file.size) return file

        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
        return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
    } catch (err) {
        console.warn('SHRINK IMAGE FAILED, uploading the original:', err)
        return file
    }
}
