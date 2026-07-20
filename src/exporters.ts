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

import type { ExportResolution, FrameData, FrameSource, ProjectSettings } from './types'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

const MAX_IMPORT_FILE_SIZE_BYTES = 120 * 1024 * 1024
const MAX_IMPORT_FRAME_COUNT = 1500
const MAX_IMPORT_DIMENSION = 8192

function pickMime() {
  const supported = mimeCandidates.find((candidate) => {
    if (typeof MediaRecorder === 'undefined') return false
    return MediaRecorder.isTypeSupported(candidate)
  })
  return supported || 'video/webm'
}

function sanitizeFrameRecord(frame: Record<string, unknown>) {
  const source: FrameSource = frame.source === 'picto' ? 'picto' : 'camera'
  if (typeof frame.id !== 'string' || typeof frame.dataUrl !== 'string') {
    throw new Error('Cada fotograma importado debe incluir id y dataUrl')
  }

  const width = Number(frame.width)
  const height = Number(frame.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Dimensiones inválidas en el proyecto importado')
  }

  if (width > MAX_IMPORT_DIMENSION || height > MAX_IMPORT_DIMENSION) {
    throw new Error('El proyecto importado supera las dimensiones máximas permitidas')
  }

  return {
    id: frame.id,
    source,
    label: typeof frame.label === 'string' ? frame.label : undefined,
    durationMs: Number(frame.durationMs) > 0 ? Number(frame.durationMs) : 1000 / 6,
    width,
    height,
    createdAt: Number(frame.createdAt) > 0 ? Number(frame.createdAt) : Date.now(),
    dataUrl: frame.dataUrl
  }
}

function ensureImportFrameCount(frameCount: number) {
  if (frameCount > MAX_IMPORT_FRAME_COUNT) {
    throw new Error(`El proyecto supera el máximo permitido de ${MAX_IMPORT_FRAME_COUNT} fotogramas`)
  }
}

function getResolutionBounds(resolution: ExportResolution) {
  switch (resolution) {
    case '720p':
      return { width: 1280, height: 720 }
    case '1080p':
      return { width: 1920, height: 1080 }
    default:
      return null
  }
}

function resolveOutputSize(frame: Pick<FrameData, 'width' | 'height'>, resolution: ExportResolution) {
  const bounds = getResolutionBounds(resolution)
  if (!bounds) {
    return { width: frame.width, height: frame.height }
  }

  const ratio = Math.min(bounds.width / frame.width, bounds.height / frame.height)
  return {
    width: Math.max(1, Math.round(frame.width * ratio)),
    height: Math.max(1, Math.round(frame.height * ratio))
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  return await response.blob()
}

async function frameToBitmap(frame: FrameData) {
  return await createImageBitmap(frame.blob)
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality = 0.92) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('No se pudo renderizar el lienzo'))
      resolve(blob)
    }, type, quality)
  })
}

async function renderFrameToCanvas(frame: FrameData, canvas: HTMLCanvasElement, resolution: ExportResolution) {
  const ctx = canvas.getContext('2d')!
  const { width, height } = resolveOutputSize(frame, resolution)
  canvas.width = width
  canvas.height = height

  const bitmap = await frameToBitmap(frame)
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
}

function takeUsableFrames(frames: FrameData[], max = 12) {
  return frames.slice(0, max)
}

export function getImportValidationConfig() {
  return {
    maxFileSizeBytes: MAX_IMPORT_FILE_SIZE_BYTES,
    maxFrameCount: MAX_IMPORT_FRAME_COUNT,
    maxDimension: MAX_IMPORT_DIMENSION
  }
}

export function validateImportFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.json') && !file.name.toLowerCase().endsWith('.ndjson')) {
    throw new Error('Solo se admiten archivos JSON o NDJSON')
  }

  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error('El archivo importado supera el tamaño máximo permitido')
  }
}

export async function exportWebM(options: {
  frames: FrameData[]
  fps: number
  resolution: ExportResolution
  audioBlob?: Blob          // pista de narración opcional — se mezcla en el WebM
  onProgress?: (current: number, total: number) => void
}): Promise<Blob> {
  const { frames, fps, resolution, audioBlob, onProgress } = options
  if (!frames.length) throw new Error('No hay fotogramas para exportar')

  const first = frames[0]
  const { width, height } = resolveOutputSize(first, resolution)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')!
  const mimeType = pickMime()
  const videoStream = canvas.captureStream(fps)

  // Mezcla de audio: si hay narración la incluimos en el mismo MediaRecorder
  let audioCtx: AudioContext | null = null
  let audioSource: AudioBufferSourceNode | null = null
  let combinedStream: MediaStream = videoStream

  if (audioBlob && audioBlob.size > 0) {
    try {
      audioCtx = new AudioContext()
      const audioBuffer = await audioCtx.decodeAudioData(await audioBlob.arrayBuffer())
      audioSource = audioCtx.createBufferSource()
      audioSource.buffer = audioBuffer
      const destination = audioCtx.createMediaStreamDestination()
      audioSource.connect(destination)
      // Mezclar pistas de vídeo + audio en un único MediaStream
      combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ])
    } catch (e) {
      console.warn('No se pudo preparar el audio para el WebM, exportando solo vídeo:', e)
      audioCtx?.close()
      audioCtx = null
      audioSource = null
      combinedStream = videoStream
    }
  }

  const recorder = new MediaRecorder(combinedStream, { mimeType })
  const chunks: Blob[] = []

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data)
  }

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = (event) => reject(event.error)
  })

  recorder.start()
  // Iniciar audio en sincronía con el comienzo del vídeo
  audioSource?.start(0)

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]
    if (!frame.blob || frame.blob.size === 0) {
      console.warn(`Skipping empty frame ${index} (${frame.id})`)
      continue
    }

    try {
      const bitmap = await frameToBitmap(frame)
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)
      bitmap.close()
    } catch (error) {
      console.error(`Error drawing frame ${index}`, error)
    }

    onProgress?.(index + 1, frames.length)
    await wait(Math.max(40, Math.round(1000 / fps)))
  }

  recorder.requestData()
  recorder.stop()
  audioSource?.stop()
  await stopped

  // Liberar AudioContext
  audioCtx?.close().catch(() => {})

  return new Blob(chunks, { type: mimeType })
}

export async function exportFramesZip(options: {
  frames: FrameData[]
  resolution: ExportResolution
  imageFormat?: 'png' | 'jpeg'
  onProgress?: (current: number, total: number) => void
}) {
  const { frames, resolution, imageFormat = 'png', onProgress } = options
  if (!frames.length) throw new Error('No hay fotogramas para exportar')

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const canvas = document.createElement('canvas')
  const mimeType = imageFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
  const extension = imageFormat === 'jpeg' ? 'jpg' : 'png'

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]
    await renderFrameToCanvas(frame, canvas, resolution)
    const blob = await canvasToBlob(canvas, mimeType, 0.92)
    zip.file(`frame-${String(index + 1).padStart(4, '0')}.${extension}`, blob)
    onProgress?.(index + 1, frames.length)
  }

  return await zip.generateAsync({ type: 'blob' })
}

export async function exportProjectJson(frames: FrameData[], settings: ProjectSettings) {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    frames: await Promise.all(
      frames.map(async (frame) => ({
        id: frame.id,
        source: frame.source,
        label: frame.label,
        durationMs: frame.durationMs,
        width: frame.width,
        height: frame.height,
        createdAt: frame.createdAt,
        dataUrl: await blobToDataUrl(frame.blob)
      }))
    ),
    settings
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `motion-edumind-${Date.now()}.json`)
}

export async function importProjectJson(file: File): Promise<{ frames: FrameData[]; settings: ProjectSettings }> {
  validateImportFile(file)
  const text = await file.text()
  const payload = JSON.parse(text)

  if (!payload.frames || !Array.isArray(payload.frames)) {
    throw new Error('Archivo de proyecto inválido')
  }

  ensureImportFrameCount(payload.frames.length)

  const frames: FrameData[] = []
  for (const rawFrame of payload.frames) {
    const frame = sanitizeFrameRecord(rawFrame as Record<string, unknown>)
    const blob = await dataUrlToBlob(frame.dataUrl)
    frames.push({
      id: frame.id,
      source: frame.source,
      label: frame.label,
      durationMs: frame.durationMs,
      width: frame.width,
      height: frame.height,
      createdAt: frame.createdAt,
      blob,
      objectUrl: URL.createObjectURL(blob)
    })
  }

  return {
    frames,
    settings: payload.settings as ProjectSettings
  }
}

export async function exportProjectNdjson(frames: FrameData[], settings: ProjectSettings) {
  const lines = await Promise.all(
    frames.map(async (frame) => (
      JSON.stringify({
        id: frame.id,
        source: frame.source,
        label: frame.label,
        durationMs: frame.durationMs,
        width: frame.width,
        height: frame.height,
        createdAt: frame.createdAt,
        dataUrl: await blobToDataUrl(frame.blob)
      })
    ))
  )

  lines.push(JSON.stringify({ settings, version: 2, exportedAt: new Date().toISOString() }))
  const blob = new Blob([lines.join('\n')], { type: 'application/x-ndjson' })
  downloadBlob(blob, `motion-edumind-${Date.now()}.ndjson`)
}

export async function importProjectNdjson(file: File): Promise<{ frames: FrameData[]; settings: ProjectSettings }> {
  validateImportFile(file)
  const text = await file.text()
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const frameLines = lines.slice(0, -1)
  const metaLine = lines.at(-1)
  ensureImportFrameCount(frameLines.length)

  const settingsJson = metaLine ? JSON.parse(metaLine) : { settings: undefined }
  const frames: FrameData[] = []

  for (const line of frameLines) {
    const frame = sanitizeFrameRecord(JSON.parse(line) as Record<string, unknown>)
    const blob = await dataUrlToBlob(frame.dataUrl)
    frames.push({
      id: frame.id,
      source: frame.source,
      label: frame.label,
      durationMs: frame.durationMs,
      width: frame.width,
      height: frame.height,
      createdAt: frame.createdAt,
      blob,
      objectUrl: URL.createObjectURL(blob)
    })
  }

  return {
    frames,
    settings: settingsJson.settings as ProjectSettings
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportZootropeStrip(frames: FrameData[]): Promise<Blob> {
  const usable = takeUsableFrames(frames, 12)
  const widthPerFrame = 240
  const margin = 32
  const canvas = document.createElement('canvas')
  canvas.width = usable.length * widthPerFrame + margin * 2
  canvas.height = 540
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0b1425'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.setLineDash([6, 6])
  ctx.beginPath()
  ctx.moveTo(margin, canvas.height - 120)
  ctx.lineTo(canvas.width - margin, canvas.height - 120)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#f5fbff'
  ctx.font = '18px "Space Grotesk", sans-serif'
  ctx.fillText('Zootropo EDUmind (imprime en A4, recorta y pega en cilindro)', margin, 40)

  for (let index = 0; index < usable.length; index += 1) {
    const bitmap = await frameToBitmap(usable[index])
    const x = margin + index * widthPerFrame
    const y = 70
    const width = widthPerFrame - 12
    const height = 320

    ctx.drawImage(bitmap, x, y, width, height)
    bitmap.close()

    ctx.fillStyle = '#96aac7'
    ctx.font = '14px "Space Grotesk", sans-serif'
    ctx.fillText(`#${index + 1}`, x, canvas.height - 90)
    ctx.fillRect(x + width - 30, canvas.height - 180, 2, 110)
  }

  return await canvasToBlob(canvas, 'image/png')
}

export async function exportPhenakistoscope(frames: FrameData[]): Promise<Blob> {
  const usable = takeUsableFrames(frames, 16)
  const size = 2048
  const center = size / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#081021'
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = '#3c7dff'
  ctx.font = '24px "Space Grotesk", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Fenakistiscopio EDUmind', center, 70)
  ctx.fillStyle = '#96aac7'
  ctx.font = '16px "Space Grotesk", sans-serif'
  ctx.fillText('Imprime en A4, recorta el disco y usa un eje/punzón', center, 100)

  const outerRadius = size * 0.44
  const innerRadius = size * 0.18
  const slotsRadius = size * 0.48
  const slotWidth = Math.PI * 2 * slotsRadius / usable.length * 0.18

  for (let index = 0; index < usable.length; index += 1) {
    const angle = (index / usable.length) * Math.PI * 2 - Math.PI / 2
    const bitmap = await frameToBitmap(usable[index])

    ctx.save()
    ctx.translate(center, center)
    ctx.rotate(angle)
    ctx.drawImage(bitmap, -innerRadius, -outerRadius, innerRadius * 2, outerRadius - innerRadius)
    ctx.restore()
    bitmap.close()

    const slotAngle = angle + Math.PI / usable.length
    ctx.save()
    ctx.translate(center, center)
    ctx.rotate(slotAngle)
    ctx.fillStyle = '#0b1425'
    ctx.fillRect(-slotWidth / 2, -slotsRadius - 24, slotWidth, 42)
    ctx.restore()
  }

  ctx.fillStyle = '#0b1425'
  ctx.beginPath()
  ctx.arc(center, center, innerRadius * 0.58, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#3ddad7'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(center, center, outerRadius + 10, 0, Math.PI * 2)
  ctx.stroke()

  return await canvasToBlob(canvas, 'image/png')
}

async function pngToPdf(png: Blob, orientation: 'portrait' | 'landscape' = 'portrait') {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const pngBytes = await png.arrayBuffer()
  const image = await pdf.embedPng(pngBytes)
  const a4: [number, number] = orientation === 'landscape' ? [842, 595] : [595, 842]
  const page = pdf.addPage(a4)
  const { width, height } = image.scaleToFit(a4[0] - 40, a4[1] - 40)

  page.drawImage(image, {
    x: (a4[0] - width) / 2,
    y: (a4[1] - height) / 2,
    width,
    height
  })

  const bytes = await pdf.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

export async function exportZootropePdf(frames: FrameData[]) {
  const png = await exportZootropeStrip(frames)
  return await pngToPdf(png, 'landscape')
}

export async function exportPhenakistoscopePdf(frames: FrameData[]) {
  const png = await exportPhenakistoscope(frames)
  return await pngToPdf(png, 'portrait')
}
