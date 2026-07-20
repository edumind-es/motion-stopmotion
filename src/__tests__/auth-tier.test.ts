import { describe, it, expect } from 'vitest'

// Testea la lógica de evaluación de tier aislada del AuthManager
// (sin instanciar el manager real que requiere browser APIs)

type AccountTier = 'free' | 'premium'

const PREMIUM_GROUPS = ['premium', 'pro', 'staff', 'admin', 'team', 'subscription:premium']

function evaluateTierFromClaims(claims: Record<string, unknown>): AccountTier {
  const groups = (claims.groups as string[]) || []
  const entitlements = (claims.entitlements as string[]) || []
  const allRoles = [...groups, ...entitlements].map((r) => r.toLowerCase())
  if (allRoles.some((g) => PREMIUM_GROUPS.some((p) => g.includes(p)))) {
    return 'premium'
  }
  return 'free'
}

describe('evaluateTierFromClaims', () => {
  it('detecta tier premium por grupo "premium"', () => {
    expect(evaluateTierFromClaims({ groups: ['premium'] })).toBe('premium')
  })

  it('detecta tier premium por grupo "staff"', () => {
    expect(evaluateTierFromClaims({ groups: ['staff'] })).toBe('premium')
  })

  it('detecta tier premium por entitlement "subscription:premium"', () => {
    expect(evaluateTierFromClaims({ entitlements: ['subscription:premium'] })).toBe('premium')
  })

  it('detecta tier premium case-insensitive', () => {
    expect(evaluateTierFromClaims({ groups: ['PREMIUM'] })).toBe('premium')
    expect(evaluateTierFromClaims({ groups: ['Pro-Users'] })).toBe('premium')
  })

  it('devuelve free si no hay roles premium', () => {
    expect(evaluateTierFromClaims({ groups: ['students', 'viewers'] })).toBe('free')
  })

  it('devuelve free con claims vacíos', () => {
    expect(evaluateTierFromClaims({})).toBe('free')
  })

  it('devuelve free con arrays vacíos', () => {
    expect(evaluateTierFromClaims({ groups: [], entitlements: [] })).toBe('free')
  })

  it('detecta tier premium por grupo compuesto "edumind-admin"', () => {
    expect(evaluateTierFromClaims({ groups: ['edumind-admin'] })).toBe('premium')
  })
})
