/*
 * Copyright (C) 2024-2026 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { FrameData, ProjectSettings } from './types'

// URL de la API del servidor. Si no está configurada, cloud sync no está disponible.
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export function isApiConfigured(): boolean {
  return API_URL.length > 0
}

// ============================================================
// Tipos de respuesta
// ============================================================

export interface CloudProjectMeta {
  id: string
  name: string
  public: boolean
  frameCount: number
  createdAt: number
  updatedAt: number
}

export interface CloudProjectFull extends CloudProjectMeta {
  payload: CloudProjectPayload
  isOwner: boolean
}

export interface CloudProjectPayload {
  version: number
  exportedAt: string
  frames: CloudFrameRecord[]
  settings: ProjectSettings
  // Pista de audio opcional (base64 dataUrl) — LOPD: solo si el usuario sube explícitamente
  audio?: {
    dataUrl: string
    mimeType: string
    durationMs: number
  }
}

export interface CloudFrameRecord {
  id: string
  source: string
  label?: string
  durationMs: number
  width: number
  height: number
  createdAt: number
  dataUrl: string
}

export interface GalleryItem {
  id: string
  name: string
  frameCount: number
  updatedAt: number
  likes: number
}

export interface GalleryPage {
  items: GalleryItem[]
  page: number
  limit: number
  total: number
}

export interface TierInfo {
  tier: 'free' | 'premium'
  sub: string
  name: string
}

// ============================================================
// Utilidades internas
// ============================================================

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
}

async function apiCall<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Convierte un Blob a data URL (base64)
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// ============================================================
// Serialización para cloud (frames → dataUrls)
// ============================================================

export async function serializeProjectForCloud(
  frames: FrameData[],
  settings: ProjectSettings,
  audioBlob?: Blob | null,
  audioDurationMs?: number,
  onProgress?: (current: number, total: number) => void
): Promise<CloudProjectPayload> {
  const total = frames.length + (audioBlob ? 1 : 0)
  const serializedFrames: CloudFrameRecord[] = []

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const dataUrl = await blobToDataUrl(frame.blob)
    serializedFrames.push({
      id: frame.id,
      source: frame.source,
      label: frame.label,
      durationMs: frame.durationMs,
      width: frame.width,
      height: frame.height,
      createdAt: frame.createdAt,
      dataUrl
    })
    onProgress?.(i + 1, total)
  }

  // Serializar audio si existe
  let audio: CloudProjectPayload['audio']
  if (audioBlob && audioBlob.size > 0) {
    const audioDataUrl = await blobToDataUrl(audioBlob)
    audio = {
      dataUrl: audioDataUrl,
      mimeType: audioBlob.type || 'audio/webm',
      durationMs: audioDurationMs ?? 0
    }
    onProgress?.(total, total)
  }

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    frames: serializedFrames,
    settings,
    ...(audio ? { audio } : {})
  }
}

// Convierte un CloudProjectPayload de vuelta a FrameData[] + audio opcional
export async function deserializeCloudProject(
  payload: CloudProjectPayload
): Promise<{ frames: FrameData[]; settings: ProjectSettings; audioBlob?: Blob; audioDurationMs?: number }> {
  const frames: FrameData[] = []

  for (const record of payload.frames) {
    const res = await fetch(record.dataUrl)
    const blob = await res.blob()
    frames.push({
      id: record.id,
      source: record.source === 'picto' ? 'picto' : 'camera',
      label: record.label,
      durationMs: record.durationMs,
      width: record.width,
      height: record.height,
      createdAt: record.createdAt,
      blob,
      objectUrl: URL.createObjectURL(blob)
    })
  }

  // Restaurar audio si el payload lo incluye
  let audioBlob: Blob | undefined
  let audioDurationMs: number | undefined
  if (payload.audio?.dataUrl) {
    const res = await fetch(payload.audio.dataUrl)
    audioBlob = await res.blob()
    audioDurationMs = payload.audio.durationMs
  }

  return { frames, settings: payload.settings, audioBlob, audioDurationMs }
}

// ============================================================
// API: Tier
// ============================================================

export async function fetchTier(token: string): Promise<TierInfo> {
  return apiCall<TierInfo>(`${API_URL}/api/tier`, {
    headers: authHeaders(token)
  })
}

// ============================================================
// API: Proyectos en la nube
// ============================================================

export async function listCloudProjects(token: string): Promise<CloudProjectMeta[]> {
  return apiCall<CloudProjectMeta[]>(`${API_URL}/api/projects`, {
    headers: authHeaders(token)
  })
}

export async function getCloudProject(id: string, token?: string): Promise<CloudProjectFull> {
  const headers: HeadersInit = token
    ? authHeaders(token)
    : { 'Content-Type': 'application/json' }
  return apiCall<CloudProjectFull>(`${API_URL}/api/projects/${encodeURIComponent(id)}`, { headers })
}

export async function uploadProject(
  projectId: string,
  name: string,
  payload: CloudProjectPayload,
  token: string,
  isPublic = false
): Promise<void> {
  await apiCall<{ ok: boolean }>(`${API_URL}/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ name, payload, public: isPublic })
  })
}

export async function deleteCloudProject(id: string, token: string): Promise<void> {
  await apiCall<{ ok: boolean }>(`${API_URL}/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token)
  })
}

export async function setProjectVisibility(
  id: string,
  isPublic: boolean,
  token: string
): Promise<void> {
  await apiCall<{ ok: boolean }>(`${API_URL}/api/projects/${encodeURIComponent(id)}/visibility`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ public: isPublic })
  })
}

// ============================================================
// API: Galería pública
// ============================================================

export async function fetchGallery(page = 0, limit = 12): Promise<GalleryPage> {
  return apiCall<GalleryPage>(
    `${API_URL}/api/gallery?page=${page}&limit=${limit}`,
    { headers: { 'Content-Type': 'application/json' } }
  )
}

export async function toggleGalleryLike(projectId: string, token: string): Promise<{ liked: boolean }> {
  return apiCall<{ ok: boolean; liked: boolean }>(
    `${API_URL}/api/gallery/${encodeURIComponent(projectId)}/like`,
    { method: 'POST', headers: authHeaders(token) }
  )
}
