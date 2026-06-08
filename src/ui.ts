/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
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

import type { ProjectSettings, FrameData } from './types'

export class UIManager {
    private overlayCanvas: HTMLCanvasElement
    private overlayCtx: CanvasRenderingContext2D

    constructor(overlayCanvas: HTMLCanvasElement) {
        this.overlayCanvas = overlayCanvas
        this.overlayCtx = overlayCanvas.getContext('2d')!
    }

    async updateOverlay(settings: ProjectSettings, lastFrame: FrameData | null, playing: boolean) {
        if (playing) return // Don't draw overlay during playback

        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height)

        // Apply transforms to match video
        // Fix: Do NOT apply transforms to the overlay canvas.
        // The content drawn here (Onion skin, Playback frames) already has
        // the transforms "baked in" from the capture step.
        // Applying them again via CSS causes double-zoom and double-mirroring.
        this.overlayCanvas.style.transform = 'none'

        if (settings.onionEnabled && lastFrame) {
            const bmp = await createImageBitmap(lastFrame.blob)
            this.overlayCtx.save()
            this.overlayCtx.globalAlpha = settings.onionOpacity
            this.overlayCtx.drawImage(bmp, 0, 0, this.overlayCanvas.width, this.overlayCanvas.height)
            this.overlayCtx.restore()
            bmp.close()
            if (settings.gridEnabled) this.drawGrid()
        } else if (settings.gridEnabled) {
            this.drawGrid()
        }
    }

    private drawGrid() {
        const w = this.overlayCanvas.width
        const h = this.overlayCanvas.height
        const step = 72

        this.overlayCtx.save()
        this.overlayCtx.strokeStyle = 'rgba(255,255,255,0.28)'
        this.overlayCtx.lineWidth = 1.2

        for (let x = 0; x < w; x += step) {
            this.overlayCtx.beginPath()
            this.overlayCtx.moveTo(x, 0)
            this.overlayCtx.lineTo(x, h)
            this.overlayCtx.stroke()
        }

        for (let y = 0; y < h; y += step) {
            this.overlayCtx.beginPath()
            this.overlayCtx.moveTo(0, y)
            this.overlayCtx.lineTo(w, y)
            this.overlayCtx.stroke()
        }

        // Center lines
        this.overlayCtx.strokeStyle = 'rgba(61, 217, 196, 0.4)'
        this.overlayCtx.lineWidth = 1.6
        this.overlayCtx.beginPath()
        this.overlayCtx.moveTo(w / 2, 0)
        this.overlayCtx.lineTo(w / 2, h)
        this.overlayCtx.stroke()

        this.overlayCtx.beginPath()
        this.overlayCtx.moveTo(0, h / 2)
        this.overlayCtx.lineTo(w, h / 2)
        this.overlayCtx.stroke()

        this.overlayCtx.restore()
    }
}
