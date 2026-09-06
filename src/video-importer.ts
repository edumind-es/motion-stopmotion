/*
 * Copyright (C) 2024-2026 Luis Vilela Acuña <contacto@edumind.es>
 * Author: Luis Vilela Acuña
 *
 * AVISO LOPD / RGPD:
 * La importación de vídeo procesa el archivo EXCLUSIVAMENTE en el
 * dispositivo del usuario. El vídeo original no se almacena; solo se
 * guardan los fotogramas individuales seleccionados por el usuario.
 * El buffer de vídeo se libera tan pronto como se extraen los fotogramas.
 *
 * En contexto educativo: asegúrate de contar con el consentimiento
 * de los participantes antes de importar vídeo con personas identificables.
 */

import type { FrameData, FrameSource } from './types'

export interface VideoImportOptions {
  fps: number
  maxFrames?: number
  source?: FrameSource
  onProgress?: (current: number, total: number) => void
}

export interface VideoImportResult {
  frames: FrameData[]
  durationMs: number
  totalExtractable: number
}

const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024  // 500 MB
const MAX_EXTRACTABLE_FRAMES = 1500

// Extrae fotogramas de un archivo de vídeo a la resolución nativa
export async function importVideoFile(
  file: File,
  opts: VideoImportOptions
): Promise<VideoImportResult> {
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error(`El archivo supera los 500 MB permitidos (${(file.size / 1024 / 1024).toFixed(0)} MB)`)
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    return await extractFramesFromUrl(objectUrl, opts)
  } finally {
    // El blob del vídeo se libera inmediatamente — LOPD: no persistimos el vídeo original
    URL.revokeObjectURL(objectUrl)
  }
}

// Extrae fotogramas de un Blob de vídeo grabado con la cámara
export async function importVideoBlob(
  blob: Blob,
  opts: VideoImportOptions
): Promise<VideoImportResult> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    return await extractFramesFromUrl(objectUrl, opts)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function extractFramesFromUrl(
  videoUrl: string,
  opts: VideoImportOptions
): Promise<VideoImportResult> {
  const { fps, onProgress } = opts
  const maxFrames = Math.min(opts.maxFrames ?? MAX_EXTRACTABLE_FRAMES, MAX_EXTRACTABLE_FRAMES)

  const video = document.createElement('video')
  video.muted = true
  video.preload = 'metadata'
  video.src = videoUrl

  // Esperar metadatos (duración, dimensiones)
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('No se pudo cargar el vídeo. Formato no compatible.'))
    setTimeout(() => reject(new Error('Tiempo de espera agotado cargando metadatos del vídeo.')), 10000)
  })

  const durationMs = video.duration * 1000
  if (!isFinite(durationMs) || durationMs <= 0) {
    throw new Error('El vídeo no tiene duración válida.')
  }

  const frameIntervalMs = 1000 / Math.max(1, fps)
  const totalExtractable = Math.min(
    Math.floor(durationMs / frameIntervalMs),
    maxFrames
  )

  if (totalExtractable === 0) {
    throw new Error('El vídeo es demasiado corto para extraer fotogramas con los FPS configurados.')
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const frames: FrameData[] = []

  // Esperar a que el vídeo esté listo para buscar
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve()
    video.currentTime = 0
  })

  canvas.width = video.videoWidth || 1280
  canvas.height = video.videoHeight || 720

  for (let i = 0; i < totalExtractable; i++) {
    const timeS = (i * frameIntervalMs) / 1000
    await seekTo(video, timeS)

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await canvasToBlob(canvas)
    const objectUrl = URL.createObjectURL(blob)

    frames.push({
      id: `vf_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      source: opts.source ?? 'camera',
      durationMs: frameIntervalMs,
      width: canvas.width,
      height: canvas.height,
      createdAt: Date.now(),
      blob,
      objectUrl
    })

    onProgress?.(i + 1, totalExtractable)
  }

  // Liberar el elemento de vídeo — no dejamos referencias al stream
  video.src = ''
  video.load()

  return { frames, durationMs, totalExtractable }
}

function seekTo(video: HTMLVideoElement, timeS: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => { video.removeEventListener('seeked', handler); resolve() }
    video.addEventListener('seeked', handler)
    video.currentTime = timeS
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('No se pudo capturar el fotograma del vídeo'))
      resolve(blob)
    }, 'image/jpeg', 0.88)
  })
}

// ============================================================
// Grabación de vídeo con la cámara del dispositivo
// (clip corto para luego extraer fotogramas)
// ============================================================

export class CameraVideoRecorder {
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private videoStream: MediaStream

  constructor(stream: MediaStream) {
    this.videoStream = stream
  }

  start(): void {
    if (this.recorder?.state === 'recording') return
    this.chunks = []
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((m) => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } })
    this.recorder = new MediaRecorder(this.videoStream, mime ? { mimeType: mime } : undefined)
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data) }
    this.recorder.start(100)
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder || this.recorder.state !== 'recording') {
        return reject(new Error('No hay grabación activa'))
      }
      this.recorder.onstop = () => {
        const mime = this.recorder?.mimeType ?? 'video/webm'
        resolve(new Blob(this.chunks, { type: mime }))
        // Los chunks se limpian — LOPD: no conservamos el vídeo en memoria tras entregarlo
        this.chunks = []
      }
      this.recorder.stop()
    })
  }

  isRecording(): boolean {
    return this.recorder?.state === 'recording'
  }
}
