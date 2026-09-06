/*
 * Copyright (C) 2024-2026 Luis Vilela Acuña <contacto@edumind.es>
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Manages text, pictograms, and drawing overlays with real-time preview on camera frames
import type { Point2D } from './types'

export interface Stroke {
    color: string
    width: number
    points: Point2D[]
}

export interface TextOverlay {
    id: string
    type: 'text'
    text: string
    x: number  // 0-1 percentage of width
    y: number  // 0-1 percentage of height
    fontSize: number
    color: string
    fontFamily: string
}

export interface PictoOverlay {
    id: string
    type: 'picto'
    img?: string
    emoji?: string
    label: string
    x: number
    y: number
    size: number
}

export interface DrawingOverlay {
    id: string
    type: 'drawing'
    strokes: Stroke[]
}

export type Overlay = TextOverlay | PictoOverlay | DrawingOverlay

export class OverlayManager {
    private overlays: Overlay[] = []
    private previewCanvas: HTMLCanvasElement | null = null
    private previewCtx: CanvasRenderingContext2D | null = null
    private imageCache: Map<string, HTMLImageElement> = new Map()

    // Set the canvas for preview rendering
    setPreviewCanvas(canvas: HTMLCanvasElement) {
        this.previewCanvas = canvas
        this.previewCtx = canvas.getContext('2d')
    }

    // Add text overlay at specified position
    addText(text: string, x = 0.5, y = 0.85): TextOverlay {
        const overlay: TextOverlay = {
            id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'text',
            text,
            x,
            y,
            fontSize: 48,
            color: '#ffffff',
            fontFamily: 'Inter, sans-serif'
        }
        this.overlays.push(overlay)
        this.renderPreview()
        return overlay
    }

    // Add pictogram overlay at specified position
    addPicto(picto: { img?: string; emoji?: string; label: string }, x = 0.5, y = 0.35): PictoOverlay {
        const overlay: PictoOverlay = {
            id: `picto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'picto',
            img: picto.img,
            emoji: picto.emoji,
            label: picto.label,
            x,
            y,
            size: 150
        }
        this.overlays.push(overlay)
        // Preload image if available
        if (picto.img) {
            this.loadImage(picto.img).catch(() => { })
        }
        this.renderPreview()
        return overlay
    }

    // Add drawing overlay with array of strokes
    addDrawing(strokes: Stroke[]): DrawingOverlay {
        const overlay: DrawingOverlay = {
            id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'drawing',
            strokes
        }
        this.overlays.push(overlay)
        this.renderPreview()
        return overlay
    }

    // Remove a specific overlay by ID
    removeOverlay(id: string) {
        this.overlays = this.overlays.filter(o => o.id !== id)
        this.renderPreview()
    }

    // Update overlay position (for drag)
    updatePosition(id: string, x: number, y: number) {
        const overlay = this.overlays.find(o => o.id === id)
        if (overlay && overlay.type !== 'drawing') {
            overlay.x = x
            overlay.y = y
            this.renderPreview()
        }
    }

    // Get all current overlays
    getOverlays(): Overlay[] {
        return [...this.overlays]
    }

    // Get overlays for capture and clear them
    popOverlaysForCapture(): Overlay[] {
        const result = [...this.overlays]
        this.overlays = []
        this.clearPreview()
        return result
    }

    // Clear all overlays
    clear() {
        this.overlays = []
        this.clearPreview()
    }

    // Check if there are pending overlays
    hasPending(): boolean {
        return this.overlays.length > 0
    }

    // Get count of overlays
    count(): number {
        return this.overlays.length
    }

    // Render preview on the overlay canvas
    async renderPreview() {
        if (!this.previewCanvas || !this.previewCtx) return

        const ctx = this.previewCtx
        const width = this.previewCanvas.width
        const height = this.previewCanvas.height

        // Clear only our overlay area (preserve onion skin if present)
        // We'll use a special compositing approach
        ctx.save()

        // Draw each overlay with preview styling
        for (const overlay of this.overlays) {
            if (overlay.type === 'text') {
                await this.paintTextPreview(ctx, overlay, width, height)
            } else if (overlay.type === 'picto') {
                await this.paintPictoPreview(ctx, overlay, width, height)
            } else if (overlay.type === 'drawing') {
                await this.paintDrawing(ctx, overlay, width, height)
            }
        }

        ctx.restore()
    }

    private clearPreview() {
        if (!this.previewCanvas || !this.previewCtx) return
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height)
    }

    // Paint overlays onto final capture canvas
    async paintOverlays(ctx: CanvasRenderingContext2D, overlays: Overlay[], width: number, height: number) {
        for (const overlay of overlays) {
            if (overlay.type === 'text') {
                await this.paintText(ctx, overlay, width, height)
            } else if (overlay.type === 'picto') {
                await this.paintPicto(ctx, overlay, width, height)
            } else if (overlay.type === 'drawing') {
                await this.paintDrawing(ctx, overlay, width, height)
            }
        }
    }

    private async paintTextPreview(ctx: CanvasRenderingContext2D, overlay: TextOverlay, width: number, height: number) {
        ctx.save()
        const x = width * overlay.x
        const y = height * overlay.y

        // Preview outline/border to indicate editable
        ctx.strokeStyle = 'rgba(61, 218, 215, 0.6)'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])

        // Measure text for border
        ctx.font = `${overlay.fontSize}px ${overlay.fontFamily}`
        const metrics = ctx.measureText(overlay.text)
        const textWidth = metrics.width
        const textHeight = overlay.fontSize

        ctx.strokeRect(x - textWidth / 2 - 8, y - textHeight / 2 - 4, textWidth + 16, textHeight + 8)
        ctx.setLineDash([])

        // Draw the text
        await this.paintText(ctx, overlay, width, height)
        ctx.restore()
    }

    private async paintPictoPreview(ctx: CanvasRenderingContext2D, overlay: PictoOverlay, width: number, height: number) {
        ctx.save()
        const x = width * overlay.x
        const y = height * overlay.y
        const size = overlay.size

        // Preview outline
        ctx.strokeStyle = 'rgba(60, 125, 255, 0.6)'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.strokeRect(x - size / 2 - 4, y - size / 2 - 4, size + 8, size + 8)
        ctx.setLineDash([])

        // Draw the pictogram
        await this.paintPicto(ctx, overlay, width, height)
        ctx.restore()
    }

    private async paintText(ctx: CanvasRenderingContext2D, overlay: TextOverlay, width: number, height: number) {
        ctx.save()
        ctx.font = `bold ${overlay.fontSize}px ${overlay.fontFamily}`
        ctx.fillStyle = overlay.color
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Shadow for readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2

        const x = width * overlay.x
        const y = height * overlay.y

        ctx.fillText(overlay.text, x, y)
        ctx.restore()
    }

    private async paintPicto(ctx: CanvasRenderingContext2D, overlay: PictoOverlay, width: number, height: number) {
        ctx.save()
        const x = width * overlay.x
        const y = height * overlay.y
        const size = overlay.size

        if (overlay.img) {
            try {
                const img = await this.loadImage(overlay.img)
                // Add white background circle for visibility
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
                ctx.beginPath()
                ctx.arc(x, y, size / 2 + 8, 0, Math.PI * 2)
                ctx.fill()

                ctx.drawImage(img, x - size / 2, y - size / 2, size, size)
            } catch {
                this.paintEmoji(ctx, overlay.emoji || '🖼️', x, y, size * 0.6)
            }
        } else {
            this.paintEmoji(ctx, overlay.emoji || '🖼️', x, y, size * 0.6)
        }

        ctx.restore()
    }

    private paintEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) {
        ctx.font = `${size}px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
        ctx.shadowBlur = 8
        ctx.fillText(emoji, x, y)
    }

    private async paintDrawing(ctx: CanvasRenderingContext2D, overlay: DrawingOverlay, width: number, height: number) {
        ctx.save()
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        for (const stroke of overlay.strokes) {
            if (stroke.points.length === 0) continue

            ctx.strokeStyle = stroke.color
            ctx.lineWidth = stroke.width

            ctx.beginPath()
            const startX = stroke.points[0].x * width
            const startY = stroke.points[0].y * height
            ctx.moveTo(startX, startY)

            for (let i = 1; i < stroke.points.length; i++) {
                const px = stroke.points[i].x * width
                const py = stroke.points[i].y * height
                ctx.lineTo(px, py)
            }
            ctx.stroke()
        }
        ctx.restore()
    }

    private loadImage(src: string): Promise<HTMLImageElement> {
        // Check cache first
        if (this.imageCache.has(src)) {
            return Promise.resolve(this.imageCache.get(src)!)
        }

        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                this.imageCache.set(src, img)
                resolve(img)
            }
            img.onerror = () => reject(new Error('Failed to load image'))
            img.src = src
        })
    }
}
