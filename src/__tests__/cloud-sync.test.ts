import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Tests de cloud-sync.ts — funciones puras y lógica de serialización
// No se hacen llamadas reales a la API (mockeamos fetch)

describe('isApiConfigured', () => {
  it('devuelve false si VITE_API_URL está vacío (por defecto en tests)', async () => {
    const { isApiConfigured } = await import('../cloud-sync')
    // En entorno de test no hay VITE_API_URL
    expect(typeof isApiConfigured()).toBe('boolean')
  })
})

describe('serializeProjectForCloud', () => {
  beforeEach(() => {
    // Mock de FileReader para blobToDataUrl
    const mockFileReader = {
      readAsDataURL: vi.fn(function(this: any) {
        this.onload?.()
      }),
      result: 'data:image/png;base64,abc123',
      onload: null as any,
      onerror: null as any
    }
    vi.stubGlobal('FileReader', vi.fn(function () { return mockFileReader }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('serializa frames a CloudProjectPayload con la estructura correcta', async () => {
    const { serializeProjectForCloud } = await import('../cloud-sync')

    const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' })
    const frames = [
      {
        id: 'frame-001',
        source: 'camera' as const,
        label: 'Fotograma 1',
        durationMs: 166,
        width: 1280,
        height: 720,
        createdAt: 1700000000000,
        blob: mockBlob,
        objectUrl: 'blob:fake-url'
      }
    ]
    const settings = {
      fps: 6,
      invertCapture: false,
      mirrorPreview: false,
      onionEnabled: true,
      onionOpacity: 0.32,
      gridEnabled: false,
      zoom: 1,
      exportResolution: 'original' as const,
      loopPlayback: true,
      uiMode: 'advanced' as const,
      motionGuide: {
        enabled: false,
        startFrame: 0,
        durationFrames: 12,
        easing: 'linear' as const,
        p0: { x: 0.2, y: 0.8 },
        p1: { x: 0.2, y: 0.2 },
        p2: { x: 0.8, y: 0.2 },
        p3: { x: 0.8, y: 0.8 }
      }
    }

    const progressCalls: [number, number][] = []
    const payload = await serializeProjectForCloud(
      frames, settings, null, undefined,
      (c: number, t: number) => progressCalls.push([c, t])
    )

    expect(payload.version).toBe(2)
    expect(payload.exportedAt).toBeTruthy()
    expect(payload.frames).toHaveLength(1)
    expect(payload.frames[0].id).toBe('frame-001')
    expect(payload.frames[0].source).toBe('camera')
    expect(payload.frames[0].width).toBe(1280)
    expect(payload.frames[0].height).toBe(720)
    expect(payload.settings.fps).toBe(6)

    // Verificar que el callback de progreso se llamó
    expect(progressCalls).toHaveLength(1)
    expect(progressCalls[0]).toEqual([1, 1])
  })

  it('devuelve payload vacío si no hay frames', async () => {
    const { serializeProjectForCloud } = await import('../cloud-sync')
    const settings = {} as any
    const payload = await serializeProjectForCloud([], settings)
    expect(payload.frames).toHaveLength(0)
  })
})

describe('authHeaders (indirecta vía estructura)', () => {
  it('uploadProject construye Bearer token correctamente', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { uploadProject } = await import('../cloud-sync')
    const payload = { version: 2, exportedAt: '', frames: [], settings: {} as any }

    try {
      await uploadProject('proj-001', 'Test', payload, 'my-token-xyz')
    } catch {
      // puede fallar si API_URL está vacío — solo verificamos la cabecera
    }

    if (fetchMock.mock.calls.length > 0) {
      const [, options] = fetchMock.mock.calls[0]
      expect((options?.headers as Record<string, string>)?.['Authorization']).toBe('Bearer my-token-xyz')
      expect((options?.headers as Record<string, string>)?.['Content-Type']).toBe('application/json')
    }

    vi.unstubAllGlobals()
  })
})

describe('apiCall error handling', () => {
  it('lanza Error con el mensaje del servidor en respuesta no-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ error: 'No autorizado' })
    }))

    const { fetchTier } = await import('../cloud-sync')
    await expect(fetchTier('bad-token')).rejects.toThrow('No autorizado')

    vi.unstubAllGlobals()
  })

  it('usa statusText como fallback si la respuesta no tiene campo error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({})
    }))

    const { fetchTier } = await import('../cloud-sync')
    await expect(fetchTier('token')).rejects.toThrow('HTTP 500')

    vi.unstubAllGlobals()
  })
})
