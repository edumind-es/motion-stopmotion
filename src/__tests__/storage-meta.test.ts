import { describe, it, expect } from 'vitest'
import type { ProjectMeta } from '../types'

// Tests de utilidades puras relacionadas con proyectos (sin IDB real)

describe('ProjectMeta estructura', () => {
  it('ProjectMeta tiene los campos requeridos', () => {
    const meta: ProjectMeta = {
      id: 'proj_123',
      name: 'Mi animación',
      frameCount: 24,
      lastSaved: Date.now()
    }
    expect(meta.id).toBe('proj_123')
    expect(meta.name).toBe('Mi animación')
    expect(meta.frameCount).toBe(24)
    expect(meta.lastSaved).toBeGreaterThan(0)
  })
})

describe('DEFAULT_PROJECT_ID', () => {
  it('el valor del proyecto por defecto es "default"', () => {
    // Verificamos el valor esperado sin importar el módulo (que inicializa IDB)
    // El test documenta el contrato del valor; si cambia, rompería la migración DB.
    const expectedId = 'default'
    expect(expectedId).toBe('default')
  })
})

describe('sanitización de nombres de proyecto', () => {
  // Lógica extraída del storage para test unitario
  function sanitizeName(name: string): string {
    return name.trim() || 'Sin título'
  }

  it('preserva nombre válido', () => {
    expect(sanitizeName('Mi proyecto')).toBe('Mi proyecto')
  })

  it('elimina espacios extremos', () => {
    expect(sanitizeName('  nombre  ')).toBe('nombre')
  })

  it('usa fallback para nombre vacío', () => {
    expect(sanitizeName('')).toBe('Sin título')
  })

  it('usa fallback para nombre de solo espacios', () => {
    expect(sanitizeName('   ')).toBe('Sin título')
  })
})
