import { createRemoteJWKSet, jwtVerify } from 'jose'

// Configuración desde entorno
const OIDC_AUTHORITY = process.env.OIDC_AUTHORITY ?? 'https://auth.edumind.es/application/o/motion-v1/'
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID ?? '91c7eca1b29c43c90ea1eb5d96747d51'
const PREMIUM_GROUPS = ['premium', 'pro', 'staff', 'admin', 'team', 'subscription:premium']

// JWKS se carga de forma lazy y se cachea automáticamente por jose
const getJWKS = () => createRemoteJWKSet(new URL(`${OIDC_AUTHORITY.replace(/\/$/, '')}/.well-known/jwks.json`))
let jwksInstance = null

function getJwks() {
  if (!jwksInstance) jwksInstance = getJWKS()
  return jwksInstance
}

export async function verifyToken(bearerToken) {
  const token = bearerToken?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('Token ausente')

  const { payload } = await jwtVerify(token, getJwks(), {
    audience: OIDC_CLIENT_ID,
    issuer: OIDC_AUTHORITY
  })

  return payload
}

export function extractTier(claims) {
  const groups = claims.groups ?? []
  const entitlements = claims.entitlements ?? []
  const allRoles = [...groups, ...entitlements].map((r) => r.toLowerCase())
  const isPremium = allRoles.some((g) => PREMIUM_GROUPS.some((p) => g.includes(p)))
  return isPremium ? 'premium' : 'free'
}

// Middleware Express: adjunta req.user con { sub, tier, email, name }
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  verifyToken(authHeader)
    .then((claims) => {
      req.user = {
        sub: claims.sub,
        email: claims.email,
        name: claims.name ?? claims.preferred_username ?? claims.email,
        tier: extractTier(claims)
      }
      next()
    })
    .catch(() => res.status(401).json({ error: 'No autenticado o token expirado' }))
}

// Middleware opcional: si hay token lo verifica, si no continúa como anónimo
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) { req.user = null; return next() }
  verifyToken(authHeader)
    .then((claims) => {
      req.user = {
        sub: claims.sub,
        email: claims.email,
        name: claims.name ?? claims.preferred_username ?? claims.email,
        tier: extractTier(claims)
      }
      next()
    })
    .catch(() => { req.user = null; next() })
}
