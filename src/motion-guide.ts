import { store } from './state'
import type { MotionGuideState, Point2D } from './types'
import { getCanvasPointerPosition } from './pointer'

export class MotionGuideManager {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private draggingPoint: keyof Pick<MotionGuideState, 'p0' | 'p1' | 'p2' | 'p3'> | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!

    this.initEvents()
  }

  private initEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
  }

  private getPointRadius() {
    return Math.max(30, this.canvas.width * 0.05)
  }

  private onPointerDown = (e: PointerEvent) => {
    const { motionGuide } = store.getState().settings
    if (!motionGuide.enabled) return

    const { x, y } = getCanvasPointerPosition(this.canvas, e)

    const threshold = this.getPointRadius() / this.canvas.width * 2.5

    const points: Array<{ key: keyof MotionGuideState; p: Point2D }> = [
      { key: 'p0', p: motionGuide.p0 },
      { key: 'p1', p: motionGuide.p1 },
      { key: 'p2', p: motionGuide.p2 },
      { key: 'p3', p: motionGuide.p3 }
    ]

    for (const { key, p } of points) {
      const dx = p.x - x
      const dy = p.y - y
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        this.draggingPoint = key as any
        this.canvas.setPointerCapture(e.pointerId)
        e.preventDefault()
        return
      }
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.draggingPoint) return

    const { x, y } = getCanvasPointerPosition(this.canvas, e)

    const { motionGuide } = store.getState().settings
    store.updateSettings({
      motionGuide: {
        ...motionGuide,
        [this.draggingPoint]: { x, y }
      }
    })
  }

  private onPointerUp = (e: PointerEvent) => {
    if (this.draggingPoint) {
      this.canvas.releasePointerCapture(e.pointerId)
      this.draggingPoint = null
    }
  }

  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'ease-in': return t * t
      case 'ease-out': return 1 - (1 - t) * (1 - t)
      case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      case 'linear':
      default: return t
    }
  }

  private getBezierPoint(t: number, p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D): Point2D {
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt
    const t2 = t * t
    const t3 = t2 * t

    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    }
  }

  public render() {
    const { settings, frames, selectedFrameId } = store.getState()
    const { motionGuide } = settings

    if (!motionGuide.enabled) return

    const w = this.canvas.width
    const h = this.canvas.height
    if (w === 0 || h === 0) return

    this.ctx.save()

    // Draw lines connecting controls
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([5, 5])
    this.ctx.beginPath()
    this.ctx.moveTo(motionGuide.p0.x * w, motionGuide.p0.y * h)
    this.ctx.lineTo(motionGuide.p1.x * w, motionGuide.p1.y * h)
    this.ctx.stroke()
    this.ctx.beginPath()
    this.ctx.moveTo(motionGuide.p2.x * w, motionGuide.p2.y * h)
    this.ctx.lineTo(motionGuide.p3.x * w, motionGuide.p3.y * h)
    this.ctx.stroke()
    this.ctx.setLineDash([])

    // Draw main Bezier curve
    this.ctx.strokeStyle = 'rgba(61, 218, 215, 0.95)'
    this.ctx.lineWidth = 10
    this.ctx.beginPath()
    this.ctx.moveTo(motionGuide.p0.x * w, motionGuide.p0.y * h)
    this.ctx.bezierCurveTo(
      motionGuide.p1.x * w, motionGuide.p1.y * h,
      motionGuide.p2.x * w, motionGuide.p2.y * h,
      motionGuide.p3.x * w, motionGuide.p3.y * h
    )
    this.ctx.stroke()

    // Calculate current frame offset relative to motion guide start
    let currentOffset = -1
    if (frames.length > 0) {
      const selectedIndex = selectedFrameId ? frames.findIndex(f => f.id === selectedFrameId) : frames.length
      currentOffset = selectedIndex - motionGuide.startFrame
    } else {
      currentOffset = -motionGuide.startFrame
    }

    // Draw interpolated points
    const count = Math.max(1, motionGuide.durationFrames)
    for (let i = 0; i <= count; i++) {
      const t = i / count
      const easedT = this.applyEasing(t, motionGuide.easing)
      const pt = this.getBezierPoint(easedT, motionGuide.p0, motionGuide.p1, motionGuide.p2, motionGuide.p3)
      
      this.ctx.beginPath()
      if (i === currentOffset) {
        // Highlight current target frame
        this.ctx.fillStyle = '#ff3366'
        this.ctx.arc(pt.x * w, pt.y * h, 8, 0, Math.PI * 2)
      } else {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        this.ctx.arc(pt.x * w, pt.y * h, 5, 0, Math.PI * 2)
      }
      this.ctx.fill()
    }

    // Draw control handles
    const handleRadius = this.getPointRadius()
    const drawHandle = (p: Point2D, color: string, isControl: boolean) => {
      this.ctx.beginPath()
      this.ctx.fillStyle = color
      this.ctx.arc(p.x * w, p.y * h, isControl ? handleRadius * 0.6 : handleRadius, 0, Math.PI * 2)
      this.ctx.fill()
      
      this.ctx.strokeStyle = '#fff'
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }

    drawHandle(motionGuide.p1, 'rgba(255, 200, 0, 0.8)', true)
    drawHandle(motionGuide.p2, 'rgba(255, 200, 0, 0.8)', true)
    drawHandle(motionGuide.p0, 'rgba(61, 218, 215, 1)', false)
    drawHandle(motionGuide.p3, 'rgba(61, 218, 215, 1)', false)

    this.ctx.restore()
  }
}
