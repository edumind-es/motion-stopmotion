import { describe, it, expect } from 'vitest'
import { checkAccess, getFeature, isPremiumFeature, getPremiumUpsellMessage, PREMIUM_FEATURES } from '../premium-gates'
import type { PremiumFeatureKey } from '../types'

describe('checkAccess', () => {
  it('devuelve true para features free independientemente del tier', () => {
    // Si alguna feature futura es 'free', debe pasar
    expect(checkAccess('cloudSync', 'free')).toBe(false)
    expect(checkAccess('cloudSync', 'premium')).toBe(true)
  })

  it('usuarios free no acceden a features premium', () => {
    const premiumKeys: PremiumFeatureKey[] = ['cloudSync', 'audioTrack', 'chromaKey', 'mp4Export', 'hdExport', 'gallery', 'collaboration']
    premiumKeys.forEach((key) => {
      expect(checkAccess(key, 'free')).toBe(false)
    })
  })

  it('usuarios premium acceden a todas las features', () => {
    const premiumKeys: PremiumFeatureKey[] = ['cloudSync', 'audioTrack', 'chromaKey', 'mp4Export', 'hdExport', 'gallery', 'collaboration']
    premiumKeys.forEach((key) => {
      expect(checkAccess(key, 'premium')).toBe(true)
    })
  })

  it('feature key desconocida devuelve true (permisivo)', () => {
    expect(checkAccess('unknownFeature' as PremiumFeatureKey, 'free')).toBe(true)
  })
})

describe('getFeature', () => {
  it('devuelve la feature correcta por key', () => {
    const f = getFeature('hdExport')
    expect(f).toBeDefined()
    expect(f?.key).toBe('hdExport')
    expect(f?.tier).toBe('premium')
  })

  it('devuelve undefined para key inexistente', () => {
    expect(getFeature('noExiste' as PremiumFeatureKey)).toBeUndefined()
  })
})

describe('isPremiumFeature', () => {
  it('identifica correctamente features premium', () => {
    expect(isPremiumFeature('cloudSync')).toBe(true)
    expect(isPremiumFeature('hdExport')).toBe(true)
  })
})

describe('getPremiumUpsellMessage', () => {
  it('incluye el nombre de la feature en el mensaje', () => {
    const msg = getPremiumUpsellMessage('cloudSync')
    expect(msg).toContain('Sincronización en la nube')
    expect(msg).toContain('premium')
  })

  it('devuelve string vacío para key inexistente', () => {
    expect(getPremiumUpsellMessage('noExiste' as PremiumFeatureKey)).toBe('')
  })
})

describe('PREMIUM_FEATURES', () => {
  it('todas las features tienen los campos requeridos', () => {
    PREMIUM_FEATURES.forEach((f) => {
      expect(f.key).toBeTruthy()
      expect(f.name).toBeTruthy()
      expect(f.description).toBeTruthy()
      expect(['free', 'premium']).toContain(f.tier)
      expect(f.icon).toBeTruthy()
    })
  })

  it('hay exactamente 7 features premium definidas', () => {
    expect(PREMIUM_FEATURES).toHaveLength(7)
  })
})
