// Mocks globales para el entorno de test (happy-dom no tiene IndexedDB ni MediaDevices)

// Stub básico de IndexedDB para tests que no necesitan persistencia real
if (!('indexedDB' in globalThis)) {
  (globalThis as any).indexedDB = {
    open: () => ({ onsuccess: null, onerror: null })
  }
}

// Silenciar console.warn en tests para reducir ruido
// vi está disponible globalmente con globals: true en vitest.config.ts
(globalThis as any).vi?.spyOn(console, 'warn')?.mockImplementation?.(() => {})
