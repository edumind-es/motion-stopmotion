/*
 * Copyright (C) 2024-2026 EDUmind - Los Mundos Edufis
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

import {
  buildTimeMarkers,
  buildTimelineMetrics,
  clampPlaybackPosition,
  formatDurationMs,
  getFrameIndexAtTime,
  getTotalDurationMs
} from './timing'
import type { FrameData, ProjectSettings, UIMode } from './types'

interface TimelineRenderModel {
  frames: FrameData[]
  settings: Pick<ProjectSettings, 'fps'>
  selectedFrameId: string | null
  playbackPositionMs: number
  timelineZoom: number
  isPlaying: boolean
  uiMode?: UIMode
}

interface TimelineCallbacks {
  onReorder: (fromId: string, toId: string) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onSelect: (id: string) => void
  onScrubStart?: () => void
  onScrub?: (positionMs: number) => void
  onScrubEnd?: (positionMs: number) => void
  onZoomChange?: (zoom: number) => void
}

const BASE_PIXELS_PER_SECOND = 420

export class TimelineManager {
  private container: HTMLElement
  private callbacks: TimelineCallbacks
  private dragId: string | null = null
  private metrics = buildTimelineMetrics([], { fps: 1 })
  private totalDurationMs = 0
  private pixelsPerMs = BASE_PIXELS_PER_SECOND / 1000
  private selectedFrameId: string | null = null
  private currentPlaybackPositionMs = 0
  private scroller: HTMLElement | null = null
  private playhead: HTMLElement | null = null
  private currentUiMode: UIMode = 'advanced'
  private lastFilmstripTailId: string | null = null
  private lastFilmstripSelectedId: string | null = null

  constructor(container: HTMLElement, callbacks: TimelineCallbacks) {
    this.container = container
    this.callbacks = callbacks
  }

  render(model: TimelineRenderModel) {
    const previousScrollLeft = this.scroller?.scrollLeft || 0

    this.metrics = buildTimelineMetrics(model.frames, model.settings)
    this.totalDurationMs = getTotalDurationMs(model.frames.length, model.settings)
    this.pixelsPerMs = (BASE_PIXELS_PER_SECOND * model.timelineZoom) / 1000
    this.selectedFrameId = model.selectedFrameId
    this.currentPlaybackPositionMs = model.playbackPositionMs
    this.currentUiMode = model.uiMode || 'advanced'

    if (!model.frames.length) {
      if (this.currentUiMode === 'beginner') {
        this.renderEmptyFilmstrip(model.settings.fps)
        return
      }
      this.container.innerHTML = `
        <div class="timeline__empty">
          <p class="helper">Captura o añade pictogramas para empezar.</p>
          <p class="timeline__empty-tip">Cuando tengas fotogramas, aquí verás segundos, playhead y orden temporal real.</p>
        </div>
      `
      this.scroller = null
      this.playhead = null
      return
    }

    // Beginner mode: simplified filmstrip rendering
    if (this.currentUiMode === 'beginner') {
      this.renderFilmstrip(model)
      return
    }

    const totalWidth = Math.max(960, Math.ceil(this.totalDurationMs * this.pixelsPerMs) + 48)
    const zoomLabel = `${model.timelineZoom.toFixed(2)}x`

    this.container.innerHTML = `
      <div class="timeline__toolbar">
        <div class="timeline__summary">
          <span class="timeline__summary-pill">${model.frames.length} frames</span>
          <span class="timeline__summary-pill">${formatDurationMs(this.totalDurationMs)}</span>
          <span class="timeline__summary-pill">${model.settings.fps} FPS</span>
        </div>
        <div class="timeline__zoom">
          <button class="timeline__zoom-btn" type="button" data-zoom-action="out" aria-label="Reducir zoom temporal">−</button>
          <span class="timeline__zoom-label">${zoomLabel}</span>
          <button class="timeline__zoom-btn" type="button" data-zoom-action="in" aria-label="Aumentar zoom temporal">+</button>
        </div>
      </div>
      <div class="timeline__viewport">
        <div class="timeline__scroller">
          <div class="timeline__inner" style="width:${totalWidth}px">
            <div class="timeline__ruler" aria-label="Regla temporal"></div>
            <div class="timeline__frames" aria-label="Fotogramas de la animación"></div>
            <div class="timeline__playhead" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    `

    this.scroller = this.container.querySelector('.timeline__scroller')
    this.playhead = this.container.querySelector('.timeline__playhead')

    this.renderMarkers()
    this.renderCards()
    this.bindZoomControls(model.timelineZoom)
    this.bindScrubbing()
    this.setPlaybackPosition(model.playbackPositionMs, model.isPlaying)

    if (this.scroller) {
      this.scroller.scrollLeft = previousScrollLeft
    }
  }

  private renderFilmstrip(model: TimelineRenderModel) {
    const lastFrame = model.frames[model.frames.length - 1] || null
    const shouldFollowLatest = Boolean(lastFrame && lastFrame.id !== this.lastFilmstripTailId)

    this.container.innerHTML = `
      <div class="timeline__filmstrip-top">
        <div class="timeline__filmstrip-summary">
          <span class="timeline__filmstrip-rec" aria-hidden="true"></span>
          <span>${model.frames.length} fotos</span>
          <span>${formatDurationMs(this.totalDurationMs)}</span>
          <span>${model.settings.fps} FPS</span>
        </div>
      </div>
      <div class="timeline__viewport timeline__viewport--filmstrip">
        <div class="timeline__scroller">
          <div class="timeline__inner timeline__inner--filmstrip">
            <div class="timeline__filmstrip-ruler" aria-label="Tiempo simplificado"></div>
            <div class="timeline__frames" aria-label="Fotogramas"></div>
          </div>
        </div>
      </div>
    `

    this.scroller = this.container.querySelector('.timeline__scroller')
    this.playhead = null

    const frameRail = this.container.querySelector<HTMLElement>('.timeline__frames')
    if (!frameRail) return

    this.renderFilmstripRuler(model.frames.length, model.settings.fps)

    this.metrics.forEach((metric) => {
      const card = this.createSimpleCard(metric.frame, metric.index)
      frameRail.appendChild(card)
    })

    if (this.scroller && model.frames.length > 0) {
      requestAnimationFrame(() => {
        if (!this.scroller) return

        if (shouldFollowLatest) {
          this.scroller.scrollTo({
            left: this.scroller.scrollWidth,
            behavior: this.lastFilmstripTailId ? 'smooth' : 'auto'
          })
        } else if (model.selectedFrameId && model.selectedFrameId !== this.lastFilmstripSelectedId) {
          this.container
            .querySelector<HTMLElement>(`.frame-card[data-id="${model.selectedFrameId}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }
      })
    }

    this.lastFilmstripTailId = lastFrame?.id || null
    this.lastFilmstripSelectedId = model.selectedFrameId
  }

  private renderEmptyFilmstrip(fps: number) {
    const slotCount = Math.max(8, Math.min(12, fps * 2))

    this.container.innerHTML = `
      <div class="timeline__filmstrip-top">
        <div class="timeline__filmstrip-summary">
          <span class="timeline__filmstrip-rec" aria-hidden="true"></span>
          <span>0 fotos</span>
          <span>0 s</span>
          <span>${fps} FPS</span>
        </div>
      </div>
      <div class="timeline__viewport timeline__viewport--filmstrip">
        <div class="timeline__scroller">
          <div class="timeline__inner timeline__inner--filmstrip">
            <div class="timeline__filmstrip-ruler" aria-label="Tiempo simplificado"></div>
            <div class="timeline__frames timeline__frames--placeholder" aria-label="Fotogramas"></div>
          </div>
        </div>
      </div>
    `

    this.scroller = this.container.querySelector('.timeline__scroller')
    this.playhead = null
    this.renderFilmstripRuler(slotCount, fps)

    const frameRail = this.container.querySelector<HTMLElement>('.timeline__frames')
    if (!frameRail) return

    for (let index = 0; index < slotCount; index += 1) {
      const card = document.createElement('article')
      card.className = 'frame-card frame-card--placeholder'
      card.innerHTML = `
        <div class="frame-card__placeholder-body">${index === 0 ? '📷' : ''}</div>
        <div class="frame-card__meta">
          <span class="frame-card__title">${index + 1}</span>
        </div>
      `
      frameRail.appendChild(card)
    }
  }

  private renderFilmstripRuler(frameCount: number, fps: number) {
    const ruler = this.container.querySelector<HTMLElement>('.timeline__filmstrip-ruler')
    if (!ruler) return

    ruler.innerHTML = ''

    for (let index = 0; index < frameCount; index += 1) {
      const tick = document.createElement('div')
      const frameNumber = index + 1
      const isMajor = frameNumber % Math.max(1, fps) === 0
      const isHalf = fps > 1 && frameNumber % Math.max(1, Math.round(fps / 2)) === 0

      tick.className = `timeline__filmstrip-tick${isMajor ? ' timeline__filmstrip-tick--major' : isHalf ? ' timeline__filmstrip-tick--half' : ''}`
      tick.innerHTML = `
        <span class="timeline__filmstrip-box"></span>
        <span class="timeline__filmstrip-label">${isMajor ? formatDurationMs((frameNumber / fps) * 1000) : ''}</span>
      `
      ruler.appendChild(tick)
    }
  }

  private createSimpleCard(frame: FrameData, index: number) {
    const card = document.createElement('article')
    card.className = 'frame-card'
    card.dataset.id = frame.id
    card.setAttribute('tabindex', '0')
    card.setAttribute('aria-label', `Foto ${index + 1}`)

    if (frame.id === this.selectedFrameId) {
      card.classList.add('is-selected', 'is-active')
    }

    card.addEventListener('click', () => this.callbacks.onSelect(frame.id))

    const img = document.createElement('img')
    img.src = frame.objectUrl
    img.alt = `Foto ${index + 1}`

    const title = document.createElement('span')
    title.className = 'frame-card__title'
    title.textContent = `${index + 1}`

    const meta = document.createElement('div')
    meta.className = 'frame-card__meta'
    meta.appendChild(title)

    card.append(img, meta)
    return card
  }

  setPlaybackPosition(positionMs: number, isPlaying: boolean) {
    this.currentPlaybackPositionMs = clampPlaybackPosition(positionMs, this.metrics.length, { fps: this.getFps() })

    if (this.playhead) {
      this.playhead.style.transform = `translateX(${this.currentPlaybackPositionMs * this.pixelsPerMs}px)`
    }

    const activeIndex = getFrameIndexAtTime(this.metrics.length, { fps: this.getFps() }, this.currentPlaybackPositionMs)
    const activeId = activeIndex >= 0 ? this.metrics[activeIndex]?.id : null

    this.container.querySelectorAll<HTMLElement>('.frame-card').forEach((card) => {
      const isSelected = card.dataset.id === this.selectedFrameId
      const isActive = card.dataset.id === activeId
      card.classList.toggle('is-selected', isSelected)
      card.classList.toggle('is-active', isActive || (isSelected && !isPlaying))
      card.setAttribute('aria-current', isActive ? 'true' : 'false')
    })
  }

  private getFps() {
    return this.metrics.length > 1
      ? Math.round(1000 / this.metrics[0].durationMs)
      : Math.round(1000 / Math.max(this.metrics[0]?.durationMs || 1000, 1))
  }

  private renderMarkers() {
    const ruler = this.container.querySelector<HTMLElement>('.timeline__ruler')
    if (!ruler) return

    const markers = buildTimeMarkers(this.totalDurationMs)
    ruler.innerHTML = ''

    markers.forEach((marker) => {
      const markerEl = document.createElement('div')
      markerEl.className = `timeline__marker${marker.isMajor ? ' timeline__marker--major' : ''}`
      markerEl.style.left = `${marker.timeMs * this.pixelsPerMs}px`
      markerEl.innerHTML = `
        <span class="timeline__marker-line"></span>
        <span class="timeline__marker-label">${marker.label}</span>
      `
      ruler.appendChild(markerEl)
    })
  }

  private renderCards() {
    const frameRail = this.container.querySelector<HTMLElement>('.timeline__frames')
    if (!frameRail) return

    frameRail.innerHTML = ''

    this.metrics.forEach((metric) => {
      const card = this.createCard(metric.frame, metric.index, metric.startMs, metric.durationMs)
      frameRail.appendChild(card)
    })
  }

  private createCard(frame: FrameData, index: number, startMs: number, durationMs: number) {
    const card = document.createElement('article')
    const width = Math.ceil(durationMs * this.pixelsPerMs)

    card.className = 'frame-card'
    card.draggable = true
    card.dataset.id = frame.id
    card.style.left = `${startMs * this.pixelsPerMs}px`
    card.style.width = `${width}px`
    card.setAttribute('tabindex', '0')
    card.setAttribute('aria-label', `Fotograma ${index + 1}, ${formatDurationMs(startMs)}`)

    card.addEventListener('click', () => this.callbacks.onSelect(frame.id))
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        this.callbacks.onSelect(frame.id)
      }
    })

    card.addEventListener('dragstart', (event) => {
      this.dragId = frame.id
      card.classList.add('dragging')
      event.dataTransfer?.setData('text/plain', frame.id)
      event.dataTransfer!.effectAllowed = 'move'
    })

    card.addEventListener('dragend', () => {
      this.dragId = null
      card.classList.remove('dragging')
      this.container.querySelectorAll('.frame-card').forEach((item) => item.classList.remove('drag-over'))
    })

    card.addEventListener('dragover', (event) => {
      event.preventDefault()
      card.classList.add('drag-over')
    })

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over')
    })

    card.addEventListener('drop', (event) => {
      event.preventDefault()
      card.classList.remove('drag-over')
      if (this.dragId && this.dragId !== frame.id) {
        this.callbacks.onReorder(this.dragId, frame.id)
      }
    })

    const badge = document.createElement('span')
    badge.className = 'badge'
    badge.textContent = frame.source === 'picto' ? 'picto' : 'cámara'

    const title = document.createElement('span')
    title.className = 'frame-card__title'
    title.textContent = `#${index + 1}`

    const time = document.createElement('span')
    time.className = 'frame-card__time'
    time.textContent = formatDurationMs(startMs)

    const meta = document.createElement('div')
    meta.className = 'frame-card__meta'
    meta.append(title, time)

    const img = document.createElement('img')
    img.src = frame.objectUrl
    img.alt = `Fotograma ${index + 1}`

    const removeBtn = document.createElement('button')
    removeBtn.className = 'frame-card__action'
    removeBtn.textContent = '✕'
    removeBtn.ariaLabel = 'Eliminar fotograma'
    removeBtn.onclick = (event) => {
      event.stopPropagation()
      this.callbacks.onRemove(frame.id)
    }

    const duplicateBtn = document.createElement('button')
    duplicateBtn.className = 'frame-card__action frame-card__action--duplicate'
    duplicateBtn.textContent = '⧉'
    duplicateBtn.ariaLabel = 'Duplicar fotograma'
    duplicateBtn.onclick = (event) => {
      event.stopPropagation()
      this.callbacks.onDuplicate(frame.id)
    }

    card.append(img, badge, meta, removeBtn, duplicateBtn)
    return card
  }

  private bindZoomControls(currentZoom: number) {
    this.container.querySelectorAll<HTMLElement>('[data-zoom-action]').forEach((button) => {
      button.onclick = () => {
        const action = button.dataset.zoomAction
        const nextZoom = action === 'in' ? currentZoom + 0.25 : currentZoom - 0.25
        this.callbacks.onZoomChange?.(nextZoom)
      }
    })
  }

  private bindScrubbing() {
    const ruler = this.container.querySelector<HTMLElement>('.timeline__ruler')
    const scroller = this.scroller
    if (!ruler || !scroller) return

    let scrubbing = false

    const scrubAt = (clientX: number) => {
      const rect = scroller.getBoundingClientRect()
      const localX = clientX - rect.left + scroller.scrollLeft
      const positionMs = clampPlaybackPosition(localX / this.pixelsPerMs, this.metrics.length, { fps: this.getFps() })
      this.setPlaybackPosition(positionMs, true)
      this.callbacks.onScrub?.(positionMs)
      return positionMs
    }

    ruler.onpointerdown = (event) => {
      scrubbing = true
      this.callbacks.onScrubStart?.()
      scrubAt(event.clientX)
      ruler.setPointerCapture(event.pointerId)
    }

    ruler.onpointermove = (event) => {
      if (!scrubbing) return
      scrubAt(event.clientX)
    }

    const finishScrub = (event: PointerEvent) => {
      if (!scrubbing) return
      scrubbing = false
      const positionMs = scrubAt(event.clientX)
      this.callbacks.onScrubEnd?.(positionMs)
      try {
        ruler.releasePointerCapture(event.pointerId)
      } catch (error) {
        console.warn('No se pudo liberar el capture del puntero', error)
      }
    }

    ruler.onpointerup = finishScrub
    ruler.onpointercancel = finishScrub
  }
}
