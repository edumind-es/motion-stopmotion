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

import type { FrameData } from './types'

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB']

export function getProjectByteSize(frames: FrameData[]) {
  return frames.reduce((total, frame) => total + frame.blob.size, 0)
}

export function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 B'

  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = value >= 100 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(precision)} ${SIZE_UNITS[unitIndex]}`
}
