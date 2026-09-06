/*
 * Copyright (C) 2024-2026 Luis Vilela Acuña <contacto@edumind.es>
 * Author: Luis Vilela Acuña
 *
 * AVISO LOPD / RGPD:
 * Las grabaciones de audio contienen datos biométricos (voz).
 * Esta implementación procesa el audio EXCLUSIVAMENTE en el dispositivo
 * del usuario. Ningún dato de audio se transmite a servidores externos
 * salvo que el usuario lo solicite explícitamente mediante la función
 * de sincronización en la nube (requiere consentimiento previo).
 * El usuario puede eliminar su grabación en cualquier momento.
 */

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped'

export interface AudioRecorderEvents {
  onStateChange: (state: RecorderState) => void
  onLevelChange: (level: number) => void        // 0–1, para el visualizador
  onDurationChange: (ms: number) => void
  onError: (message: string) => void
}

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/ogg'
]

function pickAudioMime(): string {
  return PREFERRED_MIME_TYPES.find((m) => {
    try { return MediaRecorder.isTypeSupported(m) } catch { return false }
  }) ?? ''
}

export class AudioRecorder {
  private state: RecorderState = 'idle'
  private mediaRecorder: MediaRecorder | null = null
  private audioStream: MediaStream | null = null
  private chunks: Blob[] = []
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private animationFrame = 0
  private startTime = 0
  private durationTimer = 0
  private events: AudioRecorderEvents

  constructor(events: AudioRecorderEvents) {
    this.events = events
  }

  get currentState(): RecorderState {
    return this.state
  }

  async start(): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'stopped') return

    this.setState('requesting')
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
    } catch (err) {
      this.setState('idle')
      if ((err as DOMException).name === 'NotAllowedError') {
        this.events.onError('Permiso de micrófono denegado. Actívalo en los ajustes del navegador.')
      } else {
        this.events.onError('No se pudo acceder al micrófono.')
      }
      return
    }

    this.chunks = []
    const mime = pickAudioMime()
    this.mediaRecorder = new MediaRecorder(this.audioStream, mime ? { mimeType: mime } : undefined)
    this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data) }
    this.mediaRecorder.onerror = () => {
      this.events.onError('Error durante la grabación de audio.')
      void this.stop()
    }
    this.mediaRecorder.start(250)

    // Visualizador de nivel con Web Audio API
    try {
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      const src = this.audioContext.createMediaStreamSource(this.audioStream)
      src.connect(this.analyser)
      this.tickLevel()
    } catch { /* visualizador no esencial */ }

    this.startTime = Date.now()
    this.durationTimer = window.setInterval(() => {
      this.events.onDurationChange(Date.now() - this.startTime)
    }, 100)

    this.setState('recording')
  }

  async stop(): Promise<Blob | null> {
    if (this.state !== 'recording') return null

    window.clearInterval(this.durationTimer)
    cancelAnimationFrame(this.animationFrame)

    const blob = await new Promise<Blob>((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const mime = this.mediaRecorder?.mimeType ?? 'audio/webm'
        resolve(new Blob(this.chunks, { type: mime }))
      }
      this.mediaRecorder!.stop()
    })

    this.releaseStream()
    this.setState('stopped')
    this.events.onLevelChange(0)
    return blob
  }

  discard(): void {
    if (this.state === 'recording') {
      window.clearInterval(this.durationTimer)
      cancelAnimationFrame(this.animationFrame)
      this.mediaRecorder?.stop()
      this.releaseStream()
    }
    this.chunks = []
    this.setState('idle')
    this.events.onLevelChange(0)
    this.events.onDurationChange(0)
  }

  private releaseStream() {
    this.audioStream?.getTracks().forEach((t) => t.stop())
    this.audioStream = null
    this.audioContext?.close().catch(() => {})
    this.audioContext = null
    this.analyser = null
  }

  private setState(s: RecorderState) {
    this.state = s
    this.events.onStateChange(s)
  }

  private tickLevel() {
    if (!this.analyser) return
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)
    const avg = data.reduce((a, b) => a + b, 0) / data.length
    this.events.onLevelChange(Math.min(1, avg / 128))
    this.animationFrame = requestAnimationFrame(() => this.tickLevel())
  }
}

// ============================================================
// Reproducción sincronizada con la animación
// ============================================================

export class AudioPlayback {
  private audioEl: HTMLAudioElement | null = null
  private objectUrl: string | null = null

  load(blob: Blob): void {
    this.unload()
    this.objectUrl = URL.createObjectURL(blob)
    this.audioEl = new Audio(this.objectUrl)
    this.audioEl.preload = 'auto'
  }

  play(offsetMs = 0): void {
    if (!this.audioEl) return
    this.audioEl.currentTime = offsetMs / 1000
    void this.audioEl.play()
  }

  pause(): void { this.audioEl?.pause() }

  seek(ms: number): void {
    if (this.audioEl) this.audioEl.currentTime = ms / 1000
  }

  get durationMs(): number {
    return (this.audioEl?.duration ?? 0) * 1000
  }

  unload(): void {
    this.audioEl?.pause()
    this.audioEl = null
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
  }
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
