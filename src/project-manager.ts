/*
 * Copyright (C) 2024-2026 Luis Vilela Acuña <contacto@edumind.es>
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { listProjects, createProject, deleteProject, renameProject, DEFAULT_PROJECT_ID } from './storage'
import {
  isApiConfigured,
  listCloudProjects,
  getCloudProject,
  uploadProject,
  deleteCloudProject,
  setProjectVisibility,
  fetchGallery,
  toggleGalleryLike,
  serializeProjectForCloud,
  deserializeCloudProject
} from './cloud-sync'
import type { AccountTier, FrameData, ProjectMeta, ProjectSettings } from './types'

export interface ProjectManagerCallbacks {
  onSwitch: (projectId: string, projectName: string) => Promise<void>
  onNew: (projectId: string, projectName: string) => void
  /** Devuelve frames, settings, nombre y la pista de audio si existe */
  getCurrentProject: () => {
    frames: FrameData[]
    settings: ProjectSettings
    name: string
    audioBlob?: Blob | null
    audioDurationMs?: number
  }
  /** Carga un proyecto descargado desde la nube (con audio opcional) */
  onCloudDownload: (
    frames: FrameData[],
    settings: ProjectSettings,
    name: string,
    audioBlob?: Blob,
    audioDurationMs?: number
  ) => void
  /** Feedback de estado para operaciones lentas */
  onStatus: (msg: string, isError?: boolean) => void
}

type Tab = 'local' | 'cloud' | 'gallery'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export class ProjectManager {
  private modal: HTMLElement
  private callbacks: ProjectManagerCallbacks
  private currentProjectId: string = DEFAULT_PROJECT_ID
  private activeTab: Tab = 'local'
  private isAuthenticated = false
  private tier: AccountTier = 'free'
  private getToken: () => string | null = () => null
  private galleryPage = 0

  constructor(callbacks: ProjectManagerCallbacks) {
    this.callbacks = callbacks
    this.modal = this.buildModal()
    document.body.appendChild(this.modal)
  }

  setCurrentProject(id: string) {
    this.currentProjectId = id
  }

  setAuthContext(isAuthenticated: boolean, tier: AccountTier, getToken: () => string | null) {
    this.isAuthenticated = isAuthenticated
    this.tier = tier
    this.getToken = getToken
  }

  async open(tab: Tab = 'local') {
    this.activeTab = tab
    this.galleryPage = 0
    this.modal.hidden = false
    this.modal.setAttribute('aria-hidden', 'false')
    this.renderTabs()
    await this.renderActiveTab()
    this.modal.querySelector<HTMLElement>('.pm-modal')?.focus()
  }

  close() {
    this.modal.hidden = true
    this.modal.setAttribute('aria-hidden', 'true')
  }

  private buildModal(): HTMLElement {
    const el = document.createElement('div')
    el.id = 'projectManagerModal'
    el.className = 'pm-overlay'
    el.hidden = true
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.setAttribute('aria-hidden', 'true')
    el.setAttribute('aria-label', 'Gestor de proyectos')
    el.innerHTML = `
      <div class="pm-modal" tabindex="-1">
        <div class="pm-modal__header">
          <h2 class="pm-modal__title">📁 Proyectos</h2>
          <button class="pm-modal__close" id="pmClose" aria-label="Cerrar">✕</button>
        </div>
        <nav class="pm-tabs" role="tablist" aria-label="Secciones de proyectos">
          <button class="pm-tab pm-tab--active" data-tab="local" role="tab" aria-selected="true">📱 Local</button>
          <button class="pm-tab" data-tab="cloud" role="tab" aria-selected="false">☁️ Nube</button>
          <button class="pm-tab" data-tab="gallery" role="tab" aria-selected="false">🖼️ Galería</button>
        </nav>
        <div class="pm-modal__body" id="pmBody" aria-live="polite">
          <p class="pm-empty">Cargando...</p>
        </div>
      </div>
    `

    el.querySelector('#pmClose')!.addEventListener('click', () => this.close())
    el.addEventListener('click', (e) => { if (e.target === el) this.close() })
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close() })

    el.querySelectorAll<HTMLElement>('.pm-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.dataset.tab as Tab
        this.galleryPage = 0
        this.renderTabs()
        void this.renderActiveTab()
      })
    })

    return el
  }

  private renderTabs() {
    this.modal.querySelectorAll<HTMLElement>('.pm-tab').forEach((tab) => {
      const isActive = tab.dataset.tab === this.activeTab
      tab.classList.toggle('pm-tab--active', isActive)
      tab.setAttribute('aria-selected', String(isActive))
    })
  }

  private async renderActiveTab() {
    switch (this.activeTab) {
      case 'local': return this.renderLocalTab()
      case 'cloud': return this.renderCloudTab()
      case 'gallery': return this.renderGalleryTab()
    }
  }

  // ============================================================
  // Pestaña LOCAL
  // ============================================================

  private async renderLocalTab() {
    const body = this.modal.querySelector('#pmBody')!
    body.innerHTML = `
      <div class="pm-actions">
        <button class="pm-btn pm-btn--primary" id="pmNew">+ Nuevo proyecto</button>
      </div>
      <div id="pmLocalList"><p class="pm-empty">Cargando...</p></div>
    `
    body.querySelector('#pmNew')!.addEventListener('click', () => void this.handleNew())
    await this.refreshLocalList()
  }

  private async refreshLocalList() {
    const listEl = this.modal.querySelector('#pmLocalList')
    if (!listEl) return
    const projects = await listProjects()
    if (!projects.length) {
      listEl.innerHTML = '<p class="pm-empty">No hay proyectos guardados.</p>'
      return
    }
    listEl.innerHTML = projects.map((p) => this.renderLocalCard(p)).join('')
    this.bindLocalCardListeners()
  }

  private renderLocalCard(p: ProjectMeta): string {
    const isCurrent = p.id === this.currentProjectId
    const canUpload = this.isAuthenticated && this.tier === 'premium' && isApiConfigured()
    return `
      <div class="pm-card${isCurrent ? ' pm-card--active' : ''}">
        <div class="pm-card__info">
          <span class="pm-card__name">${escapeHtml(p.name)}</span>
          <span class="pm-card__meta">${p.frameCount} fotograma${p.frameCount !== 1 ? 's' : ''} · ${formatDate(p.lastSaved)}</span>
        </div>
        <div class="pm-card__btns">
          ${!isCurrent ? `<button class="pm-btn pm-btn--sm" data-pm-switch="${p.id}" data-pm-name="${escapeHtml(p.name)}">Abrir</button>` : '<span class="pm-card__current">Activo</span>'}
          <button class="pm-btn pm-btn--sm pm-btn--ghost" data-pm-rename="${p.id}" data-pm-name="${escapeHtml(p.name)}">Renombrar</button>
          ${canUpload && isCurrent ? `<button class="pm-btn pm-btn--sm pm-btn--cloud" data-pm-upload="${p.id}" data-pm-name="${escapeHtml(p.name)}" title="Subir a la nube">↑ Nube</button>` : ''}
          ${p.id !== DEFAULT_PROJECT_ID ? `<button class="pm-btn pm-btn--sm pm-btn--danger" data-pm-delete="${p.id}" data-pm-name="${escapeHtml(p.name)}">Borrar</button>` : ''}
        </div>
      </div>
    `
  }

  private bindLocalCardListeners() {
    const listEl = this.modal.querySelector('#pmLocalList')!
    listEl.querySelectorAll<HTMLElement>('[data-pm-switch]').forEach((btn) => {
      btn.addEventListener('click', () => void this.handleSwitch(btn.dataset.pmSwitch!, btn.dataset.pmName!))
    })
    listEl.querySelectorAll<HTMLElement>('[data-pm-rename]').forEach((btn) => {
      btn.addEventListener('click', () => void this.handleRename(btn.dataset.pmRename!, btn.dataset.pmName!))
    })
    listEl.querySelectorAll<HTMLElement>('[data-pm-delete]').forEach((btn) => {
      btn.addEventListener('click', () => void this.handleDelete(btn.dataset.pmDelete!, btn.dataset.pmName!))
    })
    listEl.querySelectorAll<HTMLElement>('[data-pm-upload]').forEach((btn) => {
      btn.addEventListener('click', () => void this.handleUploadCurrent(btn.dataset.pmName!))
    })
  }

  // ============================================================
  // Pestaña NUBE
  // ============================================================

  private async renderCloudTab() {
    const body = this.modal.querySelector('#pmBody')!

    if (!isApiConfigured()) {
      body.innerHTML = `
        <div class="pm-info pm-info--warn">
          <p>La sincronización en la nube no está configurada.</p>
          <p class="pm-info__hint">Añade <code>VITE_API_URL</code> al <code>.env.local</code> y reconstruye.</p>
        </div>
      `
      return
    }

    if (!this.isAuthenticated) {
      body.innerHTML = `
        <div class="pm-info">
          <p>Inicia sesión para acceder a tus proyectos en la nube.</p>
          <button class="pm-btn pm-btn--primary pm-info__action" id="pmLoginBtn">Iniciar sesión</button>
        </div>
      `
      body.querySelector('#pmLoginBtn')?.addEventListener('click', () => {
        this.close()
        // El botón SSO del navbar gestiona el login
        document.getElementById('ssoBtn')?.click()
      })
      return
    }

    if (this.tier !== 'premium') {
      body.innerHTML = `
        <div class="pm-info pm-info--premium">
          <span class="pm-info__icon">☁️</span>
          <p>La sincronización en la nube es una función <strong>Premium</strong>.</p>
          <p class="pm-info__hint">Actualiza tu cuenta en el panel de EDUmind.</p>
          <a class="pm-btn pm-btn--primary pm-info__action" href="https://edumind.es/premium" target="_blank" rel="noopener">Ver planes</a>
        </div>
      `
      return
    }

    body.innerHTML = `
      <div class="pm-actions pm-actions--row">
        <button class="pm-btn pm-btn--primary" id="pmUploadNew">↑ Subir proyecto actual</button>
        <button class="pm-btn pm-btn--ghost" id="pmRefreshCloud">↻ Actualizar</button>
      </div>
      <div id="pmCloudList"><p class="pm-empty">Cargando proyectos en la nube...</p></div>
    `
    body.querySelector('#pmUploadNew')!.addEventListener('click', () => void this.handleUploadCurrent())
    body.querySelector('#pmRefreshCloud')!.addEventListener('click', () => void this.loadCloudList())
    await this.loadCloudList()
  }

  private async loadCloudList() {
    const listEl = this.modal.querySelector('#pmCloudList')
    if (!listEl) return
    const token = this.getToken()
    if (!token) { listEl.innerHTML = '<p class="pm-empty pm-empty--error">Token expirado. Vuelve a iniciar sesión.</p>'; return }

    listEl.innerHTML = '<p class="pm-empty">Cargando...</p>'
    try {
      const projects = await listCloudProjects(token)
      if (!projects.length) {
        listEl.innerHTML = '<p class="pm-empty">No tienes proyectos en la nube.</p>'
        return
      }
      listEl.innerHTML = projects.map((p) => `
        <div class="pm-card">
          <div class="pm-card__info">
            <span class="pm-card__name">${escapeHtml(p.name)}</span>
            <span class="pm-card__meta">${p.frameCount} fotogramas · ${formatDate(p.updatedAt)}
              ${p.public ? ' · <span class="pm-card__public">Público</span>' : ''}
            </span>
          </div>
          <div class="pm-card__btns">
            <button class="pm-btn pm-btn--sm" data-cloud-dl="${p.id}" data-cloud-name="${escapeHtml(p.name)}">↓ Abrir</button>
            <button class="pm-btn pm-btn--sm pm-btn--ghost" data-cloud-vis="${p.id}" data-cloud-public="${p.public}">
              ${p.public ? '🔒 Privar' : '🌐 Publicar'}
            </button>
            <button class="pm-btn pm-btn--sm pm-btn--danger" data-cloud-del="${p.id}" data-cloud-name="${escapeHtml(p.name)}">Borrar</button>
          </div>
        </div>
      `).join('')

      listEl.querySelectorAll<HTMLElement>('[data-cloud-dl]').forEach((btn) => {
        btn.addEventListener('click', () => void this.handleCloudDownload(btn.dataset.cloudDl!, btn.dataset.cloudName!))
      })
      listEl.querySelectorAll<HTMLElement>('[data-cloud-vis]').forEach((btn) => {
        btn.addEventListener('click', () => void this.handleCloudVisibility(btn.dataset.cloudVis!, btn.dataset.cloudPublic === 'true'))
      })
      listEl.querySelectorAll<HTMLElement>('[data-cloud-del]').forEach((btn) => {
        btn.addEventListener('click', () => void this.handleCloudDelete(btn.dataset.cloudDel!, btn.dataset.cloudName!))
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      listEl.innerHTML = `<p class="pm-empty pm-empty--error">Error al cargar: ${escapeHtml(msg)}</p>`
    }
  }

  // ============================================================
  // Pestaña GALERÍA
  // ============================================================

  private async renderGalleryTab() {
    const body = this.modal.querySelector('#pmBody')!

    if (!isApiConfigured()) {
      body.innerHTML = `<div class="pm-info pm-info--warn"><p>La galería no está disponible (API no configurada).</p></div>`
      return
    }

    body.innerHTML = `
      <div id="pmGalleryGrid" class="pm-gallery"><p class="pm-empty">Cargando galería...</p></div>
      <div class="pm-gallery__pagination" id="pmGalleryPagination"></div>
    `
    await this.loadGalleryPage()
  }

  private async loadGalleryPage() {
    const gridEl = this.modal.querySelector('#pmGalleryGrid')
    if (!gridEl) return
    gridEl.innerHTML = '<p class="pm-empty">Cargando...</p>'

    try {
      const data = await fetchGallery(this.galleryPage, 12)
      if (!data.items.length) {
        gridEl.innerHTML = '<p class="pm-empty">La galería está vacía.</p>'
        return
      }

      gridEl.innerHTML = data.items.map((item) => `
        <div class="pm-gallery__card" data-gallery-id="${item.id}">
          <div class="pm-gallery__card-body">
            <span class="pm-gallery__title">${escapeHtml(item.name)}</span>
            <span class="pm-gallery__meta">${item.frameCount} fotogramas</span>
          </div>
          <div class="pm-gallery__footer">
            <button class="pm-gallery__like" data-like-id="${item.id}" title="Me gusta">
              ♥ <span>${item.likes}</span>
            </button>
            <button class="pm-btn pm-btn--sm" data-gallery-dl="${item.id}" data-gallery-name="${escapeHtml(item.name)}">↓ Abrir</button>
          </div>
        </div>
      `).join('')

      // Paginación
      const paginationEl = this.modal.querySelector('#pmGalleryPagination')
      if (paginationEl) {
        const totalPages = Math.ceil(data.total / data.limit)
        paginationEl.innerHTML = totalPages > 1 ? `
          <button class="pm-btn pm-btn--sm pm-btn--ghost" id="pmGalleryPrev" ${this.galleryPage === 0 ? 'disabled' : ''}>← Anterior</button>
          <span class="pm-gallery__page">${this.galleryPage + 1} / ${totalPages}</span>
          <button class="pm-btn pm-btn--sm pm-btn--ghost" id="pmGalleryNext" ${this.galleryPage >= totalPages - 1 ? 'disabled' : ''}>Siguiente →</button>
        ` : ''

        paginationEl.querySelector('#pmGalleryPrev')?.addEventListener('click', () => {
          this.galleryPage = Math.max(0, this.galleryPage - 1)
          void this.loadGalleryPage()
        })
        paginationEl.querySelector('#pmGalleryNext')?.addEventListener('click', () => {
          this.galleryPage++
          void this.loadGalleryPage()
        })
      }

      // Likes
      gridEl.querySelectorAll<HTMLElement>('[data-like-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const token = this.getToken()
          if (!token) { this.callbacks.onStatus('Inicia sesión para dar me gusta', true); return }
          try {
            const result = await toggleGalleryLike(btn.dataset.likeId!, token)
            const countEl = btn.querySelector('span')
            if (countEl) {
              const current = parseInt(countEl.textContent ?? '0', 10)
              countEl.textContent = String(result.liked ? current + 1 : Math.max(0, current - 1))
            }
            btn.classList.toggle('pm-gallery__like--active', result.liked)
          } catch { /* silencioso */ }
        })
      })

      // Descargar desde galería
      gridEl.querySelectorAll<HTMLElement>('[data-gallery-dl]').forEach((btn) => {
        btn.addEventListener('click', () => void this.handleCloudDownload(btn.dataset.galleryDl!, btn.dataset.galleryName!))
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      gridEl.innerHTML = `<p class="pm-empty pm-empty--error">Error al cargar la galería: ${escapeHtml(msg)}</p>`
    }
  }

  // ============================================================
  // Handlers locales
  // ============================================================

  private async handleNew() {
    const name = prompt('Nombre del nuevo proyecto:', 'Mi proyecto')
    if (name === null) return
    const id = await createProject(name)
    this.callbacks.onNew(id, name.trim() || 'Sin título')
    this.currentProjectId = id
    await this.refreshLocalList()
  }

  private async handleSwitch(id: string, name: string) {
    if (!confirm(`¿Cambiar al proyecto "${name}"?\nEl proyecto actual se guardará automáticamente.`)) return
    this.close()
    await this.callbacks.onSwitch(id, name)
    this.currentProjectId = id
  }

  private async handleRename(id: string, currentName: string) {
    const name = prompt('Nuevo nombre:', currentName)
    if (!name || name.trim() === currentName) return
    await renameProject(id, name)
    await this.refreshLocalList()
  }

  private async handleDelete(id: string, name: string) {
    if (!confirm(`¿Borrar el proyecto "${name}" y todos sus fotogramas?\nEsta acción no se puede deshacer.`)) return
    await deleteProject(id)
    await this.refreshLocalList()
  }

  // ============================================================
  // Handlers cloud
  // ============================================================

  private async handleUploadCurrent(forceName?: string) {
    const token = this.getToken()
    if (!token) { this.callbacks.onStatus('Sesión expirada. Vuelve a iniciar sesión.', true); return }

    const { frames, settings, name, audioBlob, audioDurationMs } = this.callbacks.getCurrentProject()
    if (!frames.length) { this.callbacks.onStatus('El proyecto está vacío, no hay nada que subir.', true); return }

    const projectName = forceName ?? name
    const cloudId = this.currentProjectId
    const hasAudio = !!(audioBlob && audioBlob.size > 0)

    this.callbacks.onStatus(`Preparando subida (${frames.length} fotogramas${hasAudio ? ' + audio' : ''})...`, false)

    try {
      const payload = await serializeProjectForCloud(
        frames, settings,
        hasAudio ? audioBlob : null,
        audioDurationMs,
        (current, total) => {
          const label = hasAudio && current === total ? 'Serializando audio...' : `Serializando fotograma ${current}/${total}...`
          this.callbacks.onStatus(label, false)
        }
      )
      this.callbacks.onStatus('Subiendo a la nube...', false)
      await uploadProject(cloudId, projectName, payload, token)
      this.callbacks.onStatus(`✅ "${projectName}" sincronizado en la nube${hasAudio ? ' (con narración)' : ''}`)
      await this.loadCloudList()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      this.callbacks.onStatus(`Error al subir: ${msg}`, true)
    }
  }

  private async handleCloudDownload(cloudId: string, name: string) {
    const token = this.getToken()
    this.callbacks.onStatus(`Descargando "${name}" desde la nube...`, false)
    try {
      const full = await getCloudProject(cloudId, token ?? undefined)
      this.callbacks.onStatus('Procesando fotogramas...', false)
      const { frames, settings, audioBlob, audioDurationMs } = await deserializeCloudProject(full.payload)
      this.callbacks.onCloudDownload(frames, settings, name, audioBlob, audioDurationMs)
      const audioNote = audioBlob ? ' (con narración)' : ''
      this.callbacks.onStatus(`✅ "${name}" cargado desde la nube${audioNote}`)
      this.close()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      this.callbacks.onStatus(`Error al descargar: ${msg}`, true)
    }
  }

  private async handleCloudVisibility(cloudId: string, currentlyPublic: boolean) {
    const token = this.getToken()
    if (!token) { this.callbacks.onStatus('Sesión expirada.', true); return }
    try {
      await setProjectVisibility(cloudId, !currentlyPublic, token)
      await this.loadCloudList()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      this.callbacks.onStatus(`Error: ${msg}`, true)
    }
  }

  private async handleCloudDelete(cloudId: string, name: string) {
    if (!confirm(`¿Borrar "${name}" de la nube?\nEsta acción no se puede deshacer.`)) return
    const token = this.getToken()
    if (!token) { this.callbacks.onStatus('Sesión expirada.', true); return }
    try {
      await deleteCloudProject(cloudId, token)
      await this.loadCloudList()
      this.callbacks.onStatus(`"${name}" eliminado de la nube`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      this.callbacks.onStatus(`Error al borrar: ${msg}`, true)
    }
  }
}
