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

export class CameraManager {
    private videoEl: HTMLVideoElement
    private stream: MediaStream | null = null
    // private currentDeviceId: string | undefined

    constructor(videoEl: HTMLVideoElement) {
        this.videoEl = videoEl
    }

    async start(deviceId?: string) {
        this.stop()

        const constraints: MediaStreamConstraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                facingMode: deviceId ? undefined : { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints)
            this.videoEl.srcObject = this.stream
            await this.videoEl.play()
            // this.currentDeviceId = deviceId
            return true
        } catch (error) {
            console.warn('Error starting camera with constraints, trying fallback:', error)
            // Fallback: try without specific resolution/facingMode
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                this.videoEl.srcObject = this.stream
                await this.videoEl.play()
                return true
            } catch (fallbackError) {
                console.warn('Unable to start camera after fallback attempt:', fallbackError)
                return false
            }
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop())
            this.stream = null
        }
        this.videoEl.srcObject = null
    }

    async getDevices() {
        if (!navigator.mediaDevices?.enumerateDevices) return []
        const devices = await navigator.mediaDevices.enumerateDevices()
        return devices.filter(d => d.kind === 'videoinput')
    }

    capture(canvas: HTMLCanvasElement, opts: { invert: boolean, mirror: boolean, zoom: number }) {
        if (!this.videoEl.videoWidth) return null

        canvas.width = this.videoEl.videoWidth
        canvas.height = this.videoEl.videoHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        if (opts.invert) ctx.rotate(Math.PI)
        if (opts.mirror) ctx.scale(-1, 1)

        const zoom = opts.zoom || 1
        const drawW = canvas.width / zoom
        const drawH = canvas.height / zoom

        ctx.drawImage(
            this.videoEl,
            (this.videoEl.videoWidth - drawW) / 2,
            (this.videoEl.videoHeight - drawH) / 2,
            drawW,
            drawH,
            -canvas.width / 2,
            -canvas.height / 2,
            canvas.width,
            canvas.height
        )
        ctx.restore()

        return new Promise<Blob | null>(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/png', 0.92)
        })
    }
}
