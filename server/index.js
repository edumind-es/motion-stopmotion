// Cargar .env en desarrollo (en producción systemd usa EnvironmentFile)
import { config as loadEnv } from 'dotenv'
loadEnv()

import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import db from './db.js'
import { requireAuth, optionalAuth } from './auth.js'

const PORT = process.env.PORT ?? 3210
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'https://motion.edumind.es,http://localhost:5173').split(',')
const MAX_PROJECT_SIZE_BYTES = 150 * 1024 * 1024  // 150 MB

const app = express()

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error('Origen no permitido por CORS'))
  },
  credentials: true
}))

app.use(express.json({ limit: '150mb' }))

// ============================================================
// Health check
// ============================================================

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'motion-api', ts: Date.now() })
})

// ============================================================
// Tier verification — el cliente puede consultar su tier sin
// exponer la lógica de evaluación en el frontend
// ============================================================

app.get('/api/tier', requireAuth, (req, res) => {
  res.json({ tier: req.user.tier, sub: req.user.sub, name: req.user.name })
})

// ============================================================
// Proyectos — CRUD propio por usuario
// ============================================================

// Listar proyectos del usuario autenticado
app.get('/api/projects', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, public, frame_count, created_at, updated_at
    FROM projects
    WHERE user_sub = ?
    ORDER BY updated_at DESC
    LIMIT 100
  `).all(req.user.sub)

  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    public: Boolean(r.public),
    frameCount: r.frame_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  })))
})

// Obtener un proyecto (propio o público)
app.get('/api/projects/:id', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proyecto no encontrado' })

  const isOwner = req.user?.sub === row.user_sub
  if (!row.public && !isOwner) {
    return res.status(403).json({ error: 'Acceso denegado' })
  }

  res.json({
    id: row.id,
    name: row.name,
    public: Boolean(row.public),
    frameCount: row.frame_count,
    payload: JSON.parse(row.payload),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwner
  })
})

// Crear o actualizar (upsert) un proyecto en la nube
app.put('/api/projects/:id', requireAuth, (req, res) => {
  const { name, payload, public: isPublic } = req.body
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload requerido' })
  }

  const payloadStr = JSON.stringify(payload)
  if (Buffer.byteLength(payloadStr) > MAX_PROJECT_SIZE_BYTES) {
    return res.status(413).json({ error: 'El proyecto supera el tamaño máximo permitido (150 MB)' })
  }

  const frameCount = Array.isArray(payload.frames) ? payload.frames.length : 0
  const now = Date.now()
  const projectId = req.params.id

  // Verificar que el proyecto pertenece al usuario si ya existe
  const existing = db.prepare('SELECT user_sub FROM projects WHERE id = ?').get(projectId)
  if (existing && existing.user_sub !== req.user.sub) {
    return res.status(403).json({ error: 'No puedes modificar este proyecto' })
  }

  db.prepare(`
    INSERT INTO projects (id, user_sub, name, public, frame_count, payload, created_at, updated_at)
    VALUES (@id, @user_sub, @name, @public, @frame_count, @payload, @now, @now)
    ON CONFLICT(id) DO UPDATE SET
      name        = excluded.name,
      public      = excluded.public,
      frame_count = excluded.frame_count,
      payload     = excluded.payload,
      updated_at  = excluded.updated_at
  `).run({
    id: projectId,
    user_sub: req.user.sub,
    name: (name ?? 'Sin título').slice(0, 200),
    public: isPublic ? 1 : 0,
    frame_count: frameCount,
    payload: payloadStr,
    now
  })

  res.json({ ok: true, id: projectId })
})

// Eliminar proyecto
app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT user_sub FROM projects WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proyecto no encontrado' })
  if (row.user_sub !== req.user.sub) return res.status(403).json({ error: 'No autorizado' })

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Actualizar visibilidad pública
app.patch('/api/projects/:id/visibility', requireAuth, (req, res) => {
  const row = db.prepare('SELECT user_sub FROM projects WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proyecto no encontrado' })
  if (row.user_sub !== req.user.sub) return res.status(403).json({ error: 'No autorizado' })

  const isPublic = Boolean(req.body.public)
  db.prepare('UPDATE projects SET public = ?, updated_at = ? WHERE id = ?')
    .run(isPublic ? 1 : 0, Date.now(), req.params.id)
  res.json({ ok: true, public: isPublic })
})

// ============================================================
// Galería — proyectos públicos
// ============================================================

app.get('/api/gallery', optionalAuth, (req, res) => {
  const page = Math.max(0, parseInt(req.query.page ?? '0', 10))
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit ?? '12', 10)))
  const offset = page * limit

  const rows = db.prepare(`
    SELECT p.id, p.name, p.frame_count, p.updated_at,
           COUNT(l.project_id) AS likes
    FROM projects p
    LEFT JOIN gallery_likes l ON l.project_id = p.id
    WHERE p.public = 1
    GROUP BY p.id
    ORDER BY p.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset)

  const total = db.prepare('SELECT COUNT(*) as n FROM projects WHERE public = 1').get().n

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      frameCount: r.frame_count,
      updatedAt: r.updated_at,
      likes: r.likes
    })),
    page,
    limit,
    total
  })
})

// Me gusta en galería
app.post('/api/gallery/:id/like', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, public FROM projects WHERE id = ?').get(req.params.id)
  if (!row || !row.public) return res.status(404).json({ error: 'Proyecto público no encontrado' })

  try {
    db.prepare('INSERT INTO gallery_likes (project_id, user_sub, created_at) VALUES (?, ?, ?)')
      .run(req.params.id, req.user.sub, Date.now())
    res.json({ ok: true, liked: true })
  } catch {
    // Unique constraint → ya le dio like → toggle off
    db.prepare('DELETE FROM gallery_likes WHERE project_id = ? AND user_sub = ?')
      .run(req.params.id, req.user.sub)
    res.json({ ok: true, liked: false })
  }
})

// ============================================================
// Arranque
// ============================================================

app.listen(PORT, () => {
  console.log(`[motion-api] Servidor iniciado en http://localhost:${PORT}`)
  console.log(`[motion-api] CORS permitido desde: ${ALLOWED_ORIGINS.join(', ')}`)
})
