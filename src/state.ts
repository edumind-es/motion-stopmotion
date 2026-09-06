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

import { persistProject, loadProject, DEFAULT_PROJECT_ID, dbPromise } from './storage'
import { clampPlaybackPosition, getFrameIndexAtTime, getFrameStartMs, syncFrameDurations } from './timing'
import type { FrameData, ProjectSettings, ProjectState } from './types'

type Listener = (state: ProjectState) => void

export const DEFAULT_SETTINGS: ProjectSettings = {
  fps: 6,
  invertCapture: false,
  mirrorPreview: false,
  onionEnabled: true,
  onionOpacity: 0.32,
  gridEnabled: false,
  zoom: 1,
  exportResolution: 'original',
  loopPlayback: true,
  uiMode: 'advanced',
  motionGuide: {
    enabled: false,
    startFrame: 0,
    durationFrames: 12,
    easing: 'ease-in-out',
    p0: { x: 0.2, y: 0.8 },
    p1: { x: 0.2, y: 0.2 },
    p2: { x: 0.8, y: 0.2 },
    p3: { x: 0.8, y: 0.8 }
  }
}

const defaultSettings: ProjectSettings = { ...DEFAULT_SETTINGS }

function serializeProject(state: ProjectState) {
  return JSON.stringify({
    frames: state.frames.map((frame) => ({ ...frame, blob: null, objectUrl: null })),
    settings: state.settings
  })
}

export class Store {
  private state: ProjectState
  private listeners: Set<Listener> = new Set()
  private undoStack: string[] = []
  private redoStack: string[] = []
  private maxHistory = 20
  private saveTimeout: number | null = null
  private _projectId: string = DEFAULT_PROJECT_ID
  private _projectName: string = 'Sin título'

  constructor() {
    this.state = {
      frames: [],
      settings: { ...defaultSettings },
      dirty: false,
      selectedFrameId: null,
      playbackPositionMs: 0,
      timelineZoom: 1,
      isPlaying: false
    }
  }

  get projectId() { return this._projectId }
  get projectName() { return this._projectName }

  setProjectMeta(id: string, name: string) {
    this._projectId = id
    this._projectName = name
  }

  async init(projectId = DEFAULT_PROJECT_ID) {
    this._projectId = projectId
    const stored = await loadProject(projectId)
    if (stored) {
      this.state.frames = syncFrameDurations(stored.frames, { ...defaultSettings, ...stored.settings })
      this.state.settings = { ...defaultSettings, ...stored.settings }
      this._projectName = stored.name ?? 'Sin título'
      this.syncSelection()
      this.notify()
    }

    const storedDefaults = localStorage.getItem('motion_defaults')
    if (storedDefaults) {
      try {
        const defaults = JSON.parse(storedDefaults)
        if (!stored) {
          this.state.settings = { ...this.state.settings, ...defaults }
          syncFrameDurations(this.state.frames, this.state.settings)
          this.syncSelection()
          this.notify()
        }
      } catch (error) {
        console.warn('Failed to load defaults', error)
      }
    }
  }

  getState() {
    return this.state
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  addFrame(frame: FrameData) {
    this.pushHistory()
    frame.durationMs = Math.round(1000 / Math.max(1, this.state.settings.fps))
    this.state.frames.push(frame)
    this.state.selectedFrameId = frame.id
    this.state.playbackPositionMs = getFrameStartMs(this.state.frames.length - 1, this.state.settings)
    this.state.dirty = true
    this.notify()
  }

  removeFrame(id: string) {
    this.pushHistory()
    const index = this.state.frames.findIndex((frame) => frame.id === id)
    if (index === -1) return

    const [removed] = this.state.frames.splice(index, 1)
    if (removed) {
      this.releaseFrames([removed])
    }

    this.state.dirty = true
    this.syncSelection(index)
    this.notify()
  }

  moveFrame(fromId: string, toId: string) {
    if (fromId === toId) return

    this.pushHistory()
    const fromIndex = this.state.frames.findIndex((frame) => frame.id === fromId)
    const toIndex = this.state.frames.findIndex((frame) => frame.id === toId)

    if (fromIndex === -1 || toIndex === -1) return

    const [moved] = this.state.frames.splice(fromIndex, 1)
    this.state.frames.splice(toIndex, 0, moved)
    this.state.dirty = true
    this.syncSelection()
    this.notify()
  }

  updateSettings(patch: Partial<ProjectSettings>) {
    this.pushHistory()
    this.state.settings = { ...this.state.settings, ...patch }
    syncFrameDurations(this.state.frames, this.state.settings)
    this.state.dirty = true
    this.syncSelection()
    this.notify()
  }

  setFrames(frames: FrameData[]) {
    this.pushHistory()
    this.releaseRemovedFrames(frames)
    this.state.frames = syncFrameDurations(frames, this.state.settings)
    this.state.dirty = true
    this.syncSelection()
    this.notify()
  }

  setProject(frames: FrameData[], settings: ProjectSettings, resetHistory = false) {
    if (resetHistory) {
      this.undoStack = []
      this.redoStack = []
    } else {
      this.pushHistory()
    }

    this.releaseRemovedFrames(frames)
    this.state.settings = { ...DEFAULT_SETTINGS, ...settings }
    this.state.frames = syncFrameDurations(frames, this.state.settings)
    this.state.dirty = true
    this.syncSelection()
    this.notify()
  }

  resetProject() {
    this.state.selectedFrameId = null
    this.state.playbackPositionMs = 0
    this.state.timelineZoom = 1
    this.state.isPlaying = false
    this.setProject([], { ...DEFAULT_SETTINGS }, true)
  }

  async duplicateFrame(id: string) {
    const index = this.state.frames.findIndex((frame) => frame.id === id)
    if (index === -1) return

    this.pushHistory()
    const original = this.state.frames[index]
    const cloneBlob = new Blob([await original.blob.arrayBuffer()], { type: original.blob.type })
    const objectUrl = URL.createObjectURL(cloneBlob)
    const newFrame: FrameData = {
      ...original,
      id: Math.random().toString(36).slice(2, 9),
      createdAt: Date.now(),
      durationMs: Math.round(1000 / Math.max(1, this.state.settings.fps)),
      blob: cloneBlob,
      objectUrl
    }

    this.state.frames.splice(index + 1, 0, newFrame)
    this.state.selectedFrameId = newFrame.id
    this.state.playbackPositionMs = getFrameStartMs(index + 1, this.state.settings)
    this.state.dirty = true
    this.notify()
  }

  async undo() {
    if (this.undoStack.length === 0) return

    this.redoStack.push(serializeProject(this.state))
    const previousSnapshot = this.undoStack.pop()

    if (previousSnapshot) {
      await this.restoreSnapshot(previousSnapshot)
    }
  }

  async redo() {
    if (this.redoStack.length === 0) return

    this.undoStack.push(serializeProject(this.state))
    const nextSnapshot = this.redoStack.pop()

    if (nextSnapshot) {
      await this.restoreSnapshot(nextSnapshot)
    }
  }

  selectFrame(id: string | null, syncPlayback = true) {
    if (id && !this.state.frames.some((frame) => frame.id === id)) return
    this.state.selectedFrameId = id

    if (syncPlayback) {
      const index = id ? this.state.frames.findIndex((frame) => frame.id === id) : -1
      this.state.playbackPositionMs = index >= 0 ? getFrameStartMs(index, this.state.settings) : 0
    }

    this.notifyWithoutSave()
  }

  moveSelection(step: number) {
    if (!this.state.frames.length) return
    const currentIndex = this.state.selectedFrameId
      ? this.state.frames.findIndex((frame) => frame.id === this.state.selectedFrameId)
      : 0
    const safeIndex = Math.min(this.state.frames.length - 1, Math.max(0, currentIndex + step))
    const next = this.state.frames[safeIndex]
    this.selectFrame(next?.id || null)
  }

  setPlaybackPosition(positionMs: number, syncSelection = true) {
    this.state.playbackPositionMs = clampPlaybackPosition(positionMs, this.state.frames.length, this.state.settings)

    if (syncSelection && this.state.frames.length > 0) {
      const index = getFrameIndexAtTime(this.state.frames.length, this.state.settings, this.state.playbackPositionMs)
      this.state.selectedFrameId = this.state.frames[index]?.id || null
    }

    this.notifyWithoutSave()
  }

  setTimelineZoom(zoom: number) {
    this.state.timelineZoom = Math.min(2.4, Math.max(0.75, zoom))
    this.notifyWithoutSave()
  }

  setPlaying(isPlaying: boolean) {
    this.state.isPlaying = isPlaying
    this.notifyWithoutSave()
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state))
    this.scheduleSave()
  }

  private notifyWithoutSave() {
    this.listeners.forEach((listener) => listener(this.state))
  }

  private pushHistory() {
    this.undoStack.push(serializeProject(this.state))
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift()
    }
    this.redoStack = []
  }

  private async restoreSnapshot(json: string) {
    const data = JSON.parse(json) as Pick<ProjectState, 'frames' | 'settings'>
    const currentMap = new Map(this.state.frames.map((frame) => [frame.id, frame]))
    const restoredFrames: FrameData[] = []

    for (const frame of data.frames) {
      const existing = currentMap.get(frame.id)
      if (existing) {
        restoredFrames.push(existing)
        continue
      }

      try {
        const db = await dbPromise
        const record = await db.get('frames', frame.id)
        if (!record) {
          console.warn(`Frame ${frame.id} not found in memory or IDB. Skipping.`)
          continue
        }

        const blob = new Blob([record.buffer], { type: record.type })
        restoredFrames.push({
          id: record.id,
          source: record.source,
          label: record.label,
          durationMs: record.durationMs,
          width: record.width,
          height: record.height,
          createdAt: record.createdAt,
          blob,
          objectUrl: URL.createObjectURL(blob)
        })
      } catch (error) {
        console.error('Error restoring frame from IDB', error)
      }
    }

    this.releaseRemovedFrames(restoredFrames)
    this.state.settings = { ...DEFAULT_SETTINGS, ...data.settings }
    this.state.frames = syncFrameDurations(restoredFrames, this.state.settings)
    this.state.dirty = true
    this.syncSelection()
    this.notify()
  }

  private scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)

    this.saveTimeout = window.setTimeout(async () => {
      await persistProject(this.state.frames, this.state.settings, this._projectId, this._projectName)
      this.state.dirty = false
      this.notifyWithoutSave()
    }, 1000)
  }

  private syncSelection(preferredIndex?: number) {
    if (this.state.frames.length === 0) {
      this.state.selectedFrameId = null
      this.state.playbackPositionMs = 0
      return
    }

    const currentIndex = this.state.selectedFrameId
      ? this.state.frames.findIndex((frame) => frame.id === this.state.selectedFrameId)
      : -1

    const fallbackIndex = typeof preferredIndex === 'number'
      ? Math.min(this.state.frames.length - 1, Math.max(0, preferredIndex))
      : this.state.frames.length - 1

    const nextIndex = currentIndex >= 0 ? currentIndex : fallbackIndex
    const nextFrame = this.state.frames[nextIndex] || this.state.frames[this.state.frames.length - 1]

    this.state.selectedFrameId = nextFrame?.id || null
    this.state.playbackPositionMs = nextFrame
      ? getFrameStartMs(this.state.frames.findIndex((frame) => frame.id === nextFrame.id), this.state.settings)
      : 0
  }

  private releaseFrames(frames: FrameData[]) {
    frames.forEach((frame) => {
      try {
        URL.revokeObjectURL(frame.objectUrl)
      } catch (error) {
        console.warn('No se pudo liberar el recurso del fotograma', frame.id, error)
      }
    })
  }

  private releaseRemovedFrames(nextFrames: FrameData[]) {
    const keepIds = new Set(nextFrames.map((frame) => frame.id))
    const toRelease = this.state.frames.filter((frame) => !keepIds.has(frame.id))
    this.releaseFrames(toRelease)
  }
}

export const store = new Store()
