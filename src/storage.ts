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

import { openDB } from 'idb'
import type { DBSchema } from 'idb'
import type { FrameData, FrameMeta, ProjectSettings } from './types'

interface MotionDB extends DBSchema {
  frames: {
    key: string
    value: FrameMeta & { buffer: ArrayBuffer; type: string }
  }
  projects: {
    key: string
    value: {
      id: string
      frameOrder: string[]
      settings: ProjectSettings
      lastSaved: number
    }
  }
}

const DB_NAME = 'motion_v1_db'
const PROJECT_ID = 'default'

const dbPromise = openDB<MotionDB>(DB_NAME, 2, {
  upgrade(db, oldVersion, _newVersion, transaction) {
    if (oldVersion < 1) {
      db.createObjectStore('frames', { keyPath: 'id' })
      db.createObjectStore('projects', { keyPath: 'id' })
    }
    if (oldVersion < 2) {
      // Migration strategy: Clear old data to avoid schema mismatch issues
      // or try to migrate. For simplicity in this prototype, we clear.
      // In a real app, we would iterate and convert.
      try {
        transaction.objectStore('frames').clear()
      } catch (e) {
        console.warn('Could not clear old frames during upgrade', e)
      }
    }
  }
})

export async function persistProject(frames: FrameData[], settings: ProjectSettings) {
  const db = await dbPromise
  const tx = db.transaction(['frames', 'projects'], 'readwrite')
  const framesStore = tx.objectStore('frames')
  const projectStore = tx.objectStore('projects')

  await Promise.all(
    frames.map(async (frame) => {
      // Convert Blob to ArrayBuffer
      const buffer = await frame.blob.arrayBuffer()
      return framesStore.put({
        id: frame.id,
        source: frame.source,
        label: frame.label,
        durationMs: frame.durationMs,
        width: frame.width,
        height: frame.height,
        createdAt: frame.createdAt,
        buffer,
        type: frame.blob.type
      })
    })
  )

  await projectStore.put({
    id: PROJECT_ID,
    frameOrder: frames.map((f) => f.id),
    settings,
    lastSaved: Date.now()
  })

  await tx.done

  // Limpia fotogramas huérfanos para cumplir con RGPD y ahorrar espacio.
  try {
    await pruneFrames(frames.map((f) => f.id))
  } catch (e) {
    console.warn('No se pudo depurar fotogramas antiguos', e)
  }
}

export async function pruneFrames(idsToKeep: string[]) {
  const db = await dbPromise
  const toKeep = new Set(idsToKeep)
  const tx = db.transaction('frames', 'readwrite')
  const store = tx.objectStore('frames')
  for await (const cursor of store.iterate()) {
    if (!toKeep.has(cursor.key as string)) {
      await cursor.delete()
    }
  }
  await tx.done
}

export async function loadProject(): Promise<{ frames: FrameData[]; settings: ProjectSettings } | null> {
  const db = await dbPromise
  const project = await db.get('projects', PROJECT_ID)
  if (!project) return null

  const frames: FrameData[] = []
  for (const id of project.frameOrder) {
    const record = await db.get('frames', id)
    if (!record) continue

    // Reconstruct Blob
    const blob = new Blob([record.buffer], { type: record.type })
    const objectUrl = URL.createObjectURL(blob)

    frames.push({
      id: record.id,
      source: record.source,
      label: record.label,
      durationMs: record.durationMs,
      width: record.width,
      height: record.height,
      createdAt: record.createdAt,
      blob,
      objectUrl
    })
  }

  return {
    frames,
    settings: project.settings
  }
}

export async function clearProject() {
  const db = await dbPromise
  const tx = db.transaction(['frames', 'projects'], 'readwrite')
  await tx.objectStore('frames').clear()
  await tx.objectStore('projects').clear()
  await tx.done
}
