import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH ?? join(__dirname, 'motion_api.db')

const db = new Database(DB_PATH)

// WAL mode para mejor concurrencia de lectura
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    user_sub    TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT 'Sin título',
    public      INTEGER NOT NULL DEFAULT 0,
    frame_count INTEGER NOT NULL DEFAULT 0,
    payload     TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_sub);
  CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(public, updated_at DESC);

  CREATE TABLE IF NOT EXISTS gallery_likes (
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_sub    TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    PRIMARY KEY (project_id, user_sub)
  );
`)

export default db
