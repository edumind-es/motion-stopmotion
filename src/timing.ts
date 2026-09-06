/*
 * Copyright (C) 2024-2026 Luis Vilela Acuña <contacto@edumind.es>
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

import type { FrameData, FrameMeta, ProgressLevel, ProjectSettings } from './types'

export interface TimelineFrameMetric {
  id: string
  index: number
  startMs: number
  endMs: number
  durationMs: number
  frame: FrameData
}

export interface TimelineMarker {
  timeMs: number
  label: string
  isMajor: boolean
}

const SPANISH_NUMBER_FORMAT = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
})

export function getFrameDurationMs(settings: Pick<ProjectSettings, 'fps'>) {
  return 1000 / Math.max(1, settings.fps || 1)
}

export function getRoundedFrameDurationMs(settings: Pick<ProjectSettings, 'fps'>) {
  return Math.round(getFrameDurationMs(settings))
}

export function syncFrameDurations<T extends FrameMeta>(frames: T[], settings: Pick<ProjectSettings, 'fps'>) {
  const durationMs = getRoundedFrameDurationMs(settings)
  frames.forEach((frame) => {
    frame.durationMs = durationMs
  })
  return frames
}

export function getFrameStartMs(index: number, settings: Pick<ProjectSettings, 'fps'>) {
  return index * getFrameDurationMs(settings)
}

export function getTotalDurationMs(frameCount: number, settings: Pick<ProjectSettings, 'fps'>) {
  return frameCount * getFrameDurationMs(settings)
}

export function clampPlaybackPosition(positionMs: number, frameCount: number, settings: Pick<ProjectSettings, 'fps'>) {
  if (frameCount <= 0) return 0
  const totalDurationMs = getTotalDurationMs(frameCount, settings)
  if (totalDurationMs <= 0) return 0
  return Math.min(Math.max(positionMs, 0), Math.max(0, totalDurationMs - 1))
}

export function getFrameIndexAtTime(frameCount: number, settings: Pick<ProjectSettings, 'fps'>, positionMs: number) {
  if (frameCount <= 0) return -1
  const safePosition = clampPlaybackPosition(positionMs, frameCount, settings)
  return Math.min(frameCount - 1, Math.max(0, Math.floor(safePosition / getFrameDurationMs(settings))))
}

export function buildTimelineMetrics(frames: FrameData[], settings: Pick<ProjectSettings, 'fps'>): TimelineFrameMetric[] {
  const durationMs = getFrameDurationMs(settings)
  return frames.map((frame, index) => ({
    id: frame.id,
    index,
    startMs: index * durationMs,
    endMs: (index + 1) * durationMs,
    durationMs,
    frame
  }))
}

export function buildTimeMarkers(totalDurationMs: number) {
  const markers: TimelineMarker[] = []
  const safeDuration = Math.max(totalDurationMs, 0)

  for (let timeMs = 0; timeMs <= safeDuration; timeMs += 500) {
    const isMajor = timeMs % 1000 === 0
    markers.push({
      timeMs,
      label: formatDurationMs(timeMs),
      isMajor
    })
  }

  if (markers.length === 0 || markers[markers.length - 1]?.timeMs !== safeDuration) {
    markers.push({
      timeMs: safeDuration,
      label: formatDurationMs(safeDuration),
      isMajor: safeDuration % 1000 === 0
    })
  }

  return markers
}

export function formatDurationMs(durationMs: number) {
  if (durationMs <= 0) return '0 s'
  const seconds = durationMs / 1000
  if (seconds < 1) {
    return `${Math.round(durationMs)} ms`
  }
  return `${SPANISH_NUMBER_FORMAT.format(seconds)} s`
}

export function getFramesNeededForOneSecond(settings: Pick<ProjectSettings, 'fps'>) {
  return Math.max(1, Math.round(settings.fps || 1))
}

export function getProgressLevel(frameCount: number, settings: Pick<ProjectSettings, 'fps'>): ProgressLevel {
  const oneSecond = getFramesNeededForOneSecond(settings)
  const threeSeconds = oneSecond * 3

  if (frameCount < oneSecond) return 'red'
  if (frameCount < threeSeconds) return 'yellow'
  return 'green'
}

export function getSelectedFrame(frames: FrameData[], selectedFrameId: string | null) {
  if (!selectedFrameId) return null
  return frames.find((frame) => frame.id === selectedFrameId) || null
}
