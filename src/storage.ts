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

import { openDB } from 'idb'
import type { DBSchema } from 'idb'
import type { AudioTrackMeta, FrameData, FrameMeta, ProjectMeta, ProjectSettings } from './types'

interface MotionDB extends DBSchema {
  frames: {
    key: string
    value: FrameMeta & { buffer: ArrayBuffer; type: string }
  }
  projects: {
    key: string
    value: {
      id: string
      name: string
      frameOrder: string[]
      settings: ProjectSettings
      lastSaved: number
    }
  }
  audioTracks: {
    key: string  // projectId
    value: {
      projectId: string
      buffer: ArrayBuffer
      mimeType: string
      durationMs: number
      createdAt: number
    }
  }
}

const DB_NAME = 'motion_v1_db'
export const DEFAULT_PROJECT_ID = 'default'

const dbPromise = openDB<MotionDB>(DB_NAME, 4, {
  upgrade(db, oldVersion, _newVersion, transaction) {
    if (oldVersion < 1) {
      db.createObjectStore('frames', { keyPath: 'id' })
      db.createObjectStore('projects', { keyPath: 'id' })
    }
    if (oldVersion < 2) {
      try {
        transaction.objectStore('frames').clear()
      } catch (e) {
        console.warn('No se pudo limpiar fotogramas en migración v2', e)
      }
    }
    // v3: campo 'name' añadido (manejado en loadProject con ?? 'Sin título')
    // v4: nueva store audioTracks para pistas de audio por proyecto
    if (oldVersion < 4) {
      db.createObjectStore('audioTracks', { keyPath: 'projectId' })
    }
  }
})

export async function persistProject(
  frames: FrameData[],
  settings: ProjectSettings,
  projectId = DEFAULT_PROJECT_ID,
  projectName?: string
) {
  const db = await dbPromise
  const tx = db.transaction(['frames', 'projects'], 'readwrite')
  const framesStore = tx.objectStore('frames')
  const projectStore = tx.objectStore('projects')

  await Promise.all(
    frames.map(async (frame) => {
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

  // Preservar el nombre actual si no se pasa uno nuevo
  const existing = await db.get('projects', projectId)
  const name = projectName ?? existing?.name ?? 'Sin título'

  await projectStore.put({
    id: projectId,
    name,
    frameOrder: frames.map((f) => f.id),
    settings,
    lastSaved: Date.now()
  })

  await tx.done

  try {
    await pruneProjectFrames(projectId, frames.map((f) => f.id))
  } catch (e) {
    console.warn('No se pudo depurar fotogramas del proyecto', e)
  }
}

export async function loadProject(
  projectId = DEFAULT_PROJECT_ID
): Promise<{ frames: FrameData[]; settings: ProjectSettings; name: string } | null> {
  const db = await dbPromise
  const project = await db.get('projects', projectId)
  if (!project) return null

  const frames: FrameData[] = []
  for (const id of project.frameOrder) {
    const record = await db.get('frames', id)
    if (!record) continue

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

  return { frames, settings: project.settings, name: project.name }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await dbPromise
  const all = await db.getAll('projects')
  return all
    .map((p) => ({
      id: p.id,
      name: p.name ?? 'Sin título',
      frameCount: p.frameOrder.length,
      lastSaved: p.lastSaved
    }))
    .sort((a, b) => b.lastSaved - a.lastSaved)
}

export async function createProject(name: string): Promise<string> {
  const db = await dbPromise
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  await db.put('projects', {
    id,
    name: name.trim() || 'Sin título',
    frameOrder: [],
    settings: {} as ProjectSettings,
    lastSaved: Date.now()
  })
  return id
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  const db = await dbPromise
  const project = await db.get('projects', projectId)
  if (!project) return
  await db.put('projects', { ...project, name: name.trim() || 'Sin título' })
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await dbPromise
  const project = await db.get('projects', projectId)
  if (!project) return

  // Recoger IDs de frames de otros proyectos para no borrar frames compartidos (edge case)
  const allProjects = await db.getAll('projects')
  const frameIdsInOtherProjects = new Set(
    allProjects
      .filter((p) => p.id !== projectId)
      .flatMap((p) => p.frameOrder)
  )

  const tx = db.transaction(['frames', 'projects'], 'readwrite')
  for (const frameId of project.frameOrder) {
    if (!frameIdsInOtherProjects.has(frameId)) {
      await tx.objectStore('frames').delete(frameId)
    }
  }
  await tx.objectStore('projects').delete(projectId)
  await tx.done
}

// Elimina fotogramas del proyecto que ya no están en su frameOrder
export async function pruneProjectFrames(projectId: string, idsToKeep: string[]) {
  const db = await dbPromise

  // Recoger todos los frame IDs usados por cualquier proyecto
  const allProjects = await db.getAll('projects')
  const allUsedFrameIds = new Set(
    allProjects.flatMap((p) => p.id === projectId ? idsToKeep : p.frameOrder)
  )

  const tx = db.transaction('frames', 'readwrite')
  const store = tx.objectStore('frames')
  for await (const cursor of store.iterate()) {
    if (!allUsedFrameIds.has(cursor.key as string)) {
      await cursor.delete()
    }
  }
  await tx.done
}

// Mantener compatibilidad — limpia el proyecto por defecto
export async function clearProject(projectId = DEFAULT_PROJECT_ID) {
  await deleteProject(projectId)
  await deleteAudioTrack(projectId)
}

// ============================================================
// Audio tracks — LOPD: solo en IDB del dispositivo del usuario
// ============================================================

export async function saveAudioTrack(
  projectId: string,
  blob: Blob,
  durationMs: number
): Promise<void> {
  const db = await dbPromise
  const buffer = await blob.arrayBuffer()
  await db.put('audioTracks', {
    projectId,
    buffer,
    mimeType: blob.type || 'audio/webm',
    durationMs,
    createdAt: Date.now()
  })
}

export async function loadAudioTrack(
  projectId: string
): Promise<{ blob: Blob; meta: AudioTrackMeta } | null> {
  const db = await dbPromise
  const record = await db.get('audioTracks', projectId)
  if (!record) return null
  const blob = new Blob([record.buffer], { type: record.mimeType })
  return {
    blob,
    meta: {
      projectId: record.projectId,
      durationMs: record.durationMs,
      mimeType: record.mimeType,
      createdAt: record.createdAt,
      sizeBytes: record.buffer.byteLength
    }
  }
}

export async function deleteAudioTrack(projectId: string): Promise<void> {
  const db = await dbPromise
  await db.delete('audioTracks', projectId)
}

// Kept for backwards compat with state.ts undo/redo (openDB direct access)
export { dbPromise }
