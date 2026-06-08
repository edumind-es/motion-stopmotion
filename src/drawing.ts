import type { OverlayManager, Stroke } from './overlays'
import { getCanvasPointerPosition } from './pointer'

export class DrawingManager {
  private canvas: HTMLCanvasElement
  private overlayManager: OverlayManager
  public enabled = false
  private isDrawing = false
  private currentStroke: Stroke | null = null
  private color = '#ff3366'
  private brushWidth = 6
  private boundOverlayId: string | null = null

  constructor(canvas: HTMLCanvasElement, overlayManager: OverlayManager) {
    this.canvas = canvas
    this.overlayManager = overlayManager
    this.initEvents()
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) {
      this.isDrawing = false
      this.currentStroke = null
      this.boundOverlayId = null
    }
  }

  setBrush(color: string, width: number) {
    this.color = color
    this.brushWidth = width
  }

  private initEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.enabled) return

    const { x, y } = getCanvasPointerPosition(this.canvas, e)

    this.isDrawing = true
    this.currentStroke = { color: this.color, width: this.brushWidth, points: [{ x, y }] }
    this.canvas.setPointerCapture(e.pointerId)
    e.preventDefault()

    // Create a new drawing overlay if we don't have one active, or if we want a new one
    if (!this.boundOverlayId || !this.overlayManager.getOverlays().find(o => o.id === this.boundOverlayId)) {
      const overlay = this.overlayManager.addDrawing([this.currentStroke])
      this.boundOverlayId = overlay.id
    } else {
      const overlay = this.overlayManager.getOverlays().find(o => o.id === this.boundOverlayId)
      if (overlay && overlay.type === 'drawing') {
        overlay.strokes.push(this.currentStroke)
        this.overlayManager.renderPreview()
      }
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.enabled || !this.isDrawing || !this.currentStroke || !this.boundOverlayId) return

    const { x, y } = getCanvasPointerPosition(this.canvas, e)

    this.currentStroke.points.push({ x, y })
    
    // Quick render strategy: for high performance, we could just draw the line segment here
    // but the overlay manager is fast enough for typical use cases.
    this.overlayManager.renderPreview()
  }

  private onPointerUp = (e: PointerEvent) => {
    if (!this.enabled || !this.isDrawing) return
    this.isDrawing = false
    this.currentStroke = null
    this.canvas.releasePointerCapture(e.pointerId)
  }
}
