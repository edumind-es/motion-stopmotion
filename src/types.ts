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

export type FrameSource = 'camera' | 'picto'
export type ExportResolution = 'original' | '720p' | '1080p'
export type UIMode = 'beginner' | 'advanced'
export type AccountTier = 'free' | 'premium'
export type AutoCaptureIntervalSeconds = 3 | 5 | 10
export type ProgressLevel = 'red' | 'yellow' | 'green'
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export interface Point2D {
  x: number
  y: number
}

export interface MotionGuideState {
  enabled: boolean
  startFrame: number
  durationFrames: number
  easing: EasingType
  p0: Point2D
  p1: Point2D
  p2: Point2D
  p3: Point2D
}

export type PremiumFeatureKey =
  | 'cloudSync'
  | 'audioTrack'
  | 'chromaKey'
  | 'mp4Export'
  | 'hdExport'
  | 'gallery'
  | 'collaboration'

export interface FrameMeta {
  id: string
  source: FrameSource
  label?: string
  durationMs: number
  width: number
  height: number
  createdAt: number
}

export interface FrameData extends FrameMeta {
  blob: Blob
  objectUrl: string
}

export interface ProjectSettings {
  fps: number
  invertCapture: boolean
  mirrorPreview: boolean
  onionEnabled: boolean
  onionOpacity: number
  gridEnabled: boolean
  zoom: number
  exportResolution: ExportResolution
  loopPlayback: boolean
  uiMode: UIMode
  motionGuide: MotionGuideState
}

export interface ProjectState {
  frames: FrameData[]
  settings: ProjectSettings
  dirty: boolean
  selectedFrameId: string | null
  playbackPositionMs: number
  timelineZoom: number
  isPlaying: boolean
}

export interface PictoItem {
  id: string
  label: string
  emoji?: string
  img?: string
  keywords?: string[]
  catalog?: string
}

export interface PictoCategory {
  key: string
  name: string
  items: PictoItem[]
}

export interface PictoCatalog {
  name: string
  license?: string
  attribution?: string
  note?: string
  categories: PictoCategory[]
}
