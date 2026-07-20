import { describe, it, expect } from 'vitest'
import { formatDuration } from '../audio-recorder'

describe('formatDuration', () => {
  it('formatea 0ms como 00:00', () => {
    expect(formatDuration(0)).toBe('00:00')
  })

  it('formatea 1000ms como 00:01', () => {
    expect(formatDuration(1000)).toBe('00:01')
  })

  it('formatea 60000ms como 01:00', () => {
    expect(formatDuration(60000)).toBe('01:00')
  })

  it('formatea 90500ms como 01:30', () => {
    expect(formatDuration(90500)).toBe('01:30')
  })

  it('formatea 3661000ms como 61:01', () => {
    expect(formatDuration(3661000)).toBe('61:01')
  })
})

describe('AudioRecorder — gestión de estado', () => {
  it('currentState inicial es idle', async () => {
    const { AudioRecorder } = await import('../audio-recorder')
    const recorder = new AudioRecorder({
      onStateChange: () => {},
      onLevelChange: () => {},
      onDurationChange: () => {},
      onError: () => {}
    })
    expect(recorder.currentState).toBe('idle')
  })

  it('discard() desde idle no lanza error', async () => {
    const { AudioRecorder } = await import('../audio-recorder')
    const recorder = new AudioRecorder({
      onStateChange: () => {},
      onLevelChange: () => {},
      onDurationChange: () => {},
      onError: () => {}
    })
    expect(() => recorder.discard()).not.toThrow()
    expect(recorder.currentState).toBe('idle')
  })
})

describe('AudioPlayback', () => {
  it('durationMs devuelve 0 sin track cargada', async () => {
    const { AudioPlayback } = await import('../audio-recorder')
    const pb = new AudioPlayback()
    expect(pb.durationMs).toBe(0)
  })

  it('unload() no lanza error sin track', async () => {
    const { AudioPlayback } = await import('../audio-recorder')
    const pb = new AudioPlayback()
    expect(() => pb.unload()).not.toThrow()
  })
})

describe('VideoImporter — validación de tamaño', () => {
  it('importVideoFile rechaza archivos > 500 MB', async () => {
    const { importVideoFile } = await import('../video-importer')
    const bigFile = new File(['x'.repeat(10)], 'big.mp4', { type: 'video/mp4' })
    Object.defineProperty(bigFile, 'size', { value: 501 * 1024 * 1024 })

    await expect(importVideoFile(bigFile, { fps: 6 })).rejects.toThrow('500 MB')
  })
})

describe('CameraVideoRecorder', () => {
  it('isRecording() devuelve false antes de start()', async () => {
    const { CameraVideoRecorder } = await import('../video-importer')
    const fakeStream = { getTracks: () => [] } as unknown as MediaStream
    const rec = new CameraVideoRecorder(fakeStream)
    expect(rec.isRecording()).toBe(false)
  })
})
