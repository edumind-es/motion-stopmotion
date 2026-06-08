/*
 * Copyright (C) 2024-2026 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import './style.css'
import { store } from './state'
import { CameraManager } from './camera'
import { TimelineManager } from './timeline'
import { UIManager } from './ui'
import { OverlayManager } from './overlays'
import { MotionGuideManager } from './motion-guide'
import { DrawingManager } from './drawing'
import { createPictoFrame, flattenPictoItems, loadPictoCatalogs, searchArasaac } from './pictograms'
import { initPWA } from './pwa'
import { clearProject } from './storage'
import { authManager } from './auth'
import { formatBytes, getProjectByteSize } from './project-metrics'
import {
  buildTimelineMetrics,
  formatDurationMs,
  getFrameIndexAtTime,
  getFramesNeededForOneSecond,
  getProgressLevel,
  getSelectedFrame,
  getTotalDurationMs
} from './timing'
import { PREMIUM_FEATURES, checkAccess, getPremiumUpsellMessage } from './premium-gates'
import type { AutoCaptureIntervalSeconds, FrameData, PictoItem, PremiumFeatureKey, ProjectState, ProjectSettings } from './types'

type ExportersModule = typeof import('./exporters')

const APP_VERSION = '3.0.0'
const MAX_FRAME_COUNT = 1500
const EXPORT_STATUS_CLEAR_MS = 2600

const app = document.getElementById('app')!

const navbar = document.createElement('nav')
navbar.className = 'navbar'
navbar.setAttribute('role', 'navigation')
navbar.setAttribute('aria-label', 'Navegación principal')
navbar.innerHTML = `
  <div class="navbar__container">
    <a href="https://edumind.es" class="navbar__brand" aria-label="EDUmind - Ir a inicio">
      <img src="./icons/logo-motion.png" alt="Motion EDUmind" class="navbar__logo" />
      <span class="navbar__title">Motion</span>
    </a>
    <div class="navbar__nav">
      <a href="https://edumind.es/#aplicaciones" class="navbar__link" target="_blank" rel="noopener noreferrer">Aplicaciones</a>
      <a href="https://edumind.es/#documentacion" class="navbar__link" target="_blank" rel="noopener noreferrer">Documentación</a>
      <button class="navbar__link auth-btn" id="ssoBtn">...</button>
      <span class="navbar__badge">
        <span>🎬</span>
        <span>v${APP_VERSION}</span>
      </span>
    </div>
  </div>
`
document.body.insertBefore(navbar, app)

const skipLink = document.createElement('a')
skipLink.href = '#main-content'
skipLink.className = 'skip-link'
skipLink.textContent = 'Saltar al contenido principal'
document.body.insertBefore(skipLink, navbar)

app.innerHTML = `
  <header class="header" id="main-content">
    <div class="header__pill">
      <span>🎬</span>
      <span>PWA EDUmind · Stopmotion accesible y multiplataforma</span>
    </div>
    <h1 class="title">Motion EDUmind</h1>
    <p class="subtitle">Captura, organiza y exporta animaciones stopmotion con una timeline temporal real, controles adaptados a móvil y herramientas pedagógicas para aula y creación audiovisual.</p>
  </header>

  <div class="workspace">
    <aside class="sidebar sidebar--left">
      <div class="sidebar__section">
        <h5 class="sidebar__title">Experiencia</h5>
        <button class="sidebar__btn sidebar__btn--accent" id="uiModeToggle" title="Alternar entre modo guiado y modo avanzado">
          <span class="sidebar__icon">🧭</span>
          <span class="sidebar__label">Modo pro</span>
        </button>
        <p class="sidebar__helper" id="uiModeStatus">Vista completa activa para editar y exportar.</p>
      </div>

      <div class="sidebar__section">
        <h5 class="sidebar__title">Cámara</h5>
        <select id="cameraSelect" class="sidebar__select" title="Seleccionar cámara"></select>
        <button class="sidebar__btn" id="rotate" title="Girar cámara">
          <span class="sidebar__icon">🔄</span>
          <span class="sidebar__label">Girar</span>
        </button>
        <button class="sidebar__btn" id="mirror" title="Espejo horizontal">
          <span class="sidebar__icon">🪞</span>
          <span class="sidebar__label">Espejo</span>
        </button>
      </div>

      <div class="sidebar__section">
        <h5 class="sidebar__title">Ajustes</h5>
        <div class="sidebar__control">
          <label class="sidebar__label-inline sidebar__label-inline--stack">
            <span class="sidebar__icon">🎬</span>
            <span>FPS</span>
            <input type="range" id="fps" min="1" max="15" step="1" class="sidebar__slider" />
            <span class="sidebar__value" id="fpsValue">6 FPS</span>
          </label>
        </div>
        <button class="sidebar__btn sidebar__btn--toggle" id="loopToggle" title="Reproducción en bucle">
          <span class="sidebar__icon">🔁</span>
          <span class="sidebar__label">Bucle</span>
        </button>
        <button class="sidebar__btn sidebar__btn--toggle" id="onionToggle" title="Onion Skin - ver frame anterior">
          <span class="sidebar__icon">👻</span>
          <span class="sidebar__label">Onion</span>
        </button>
        <div class="sidebar__control sidebar__control--sub">
          <input type="range" id="onionOpacity" min="0" max="1" step="0.05" class="sidebar__slider sidebar__slider--small" title="Opacidad del onion skin" />
        </div>
        <button class="sidebar__btn sidebar__btn--toggle" id="gridToggle" title="Mostrar rejilla de composición">
          <span class="sidebar__icon">📐</span>
          <span class="sidebar__label">Rejilla</span>
        </button>
        <div class="sidebar__control">
          <label class="sidebar__label-inline sidebar__label-inline--stack">
            <span class="sidebar__icon">🔍</span>
            <span>Zoom</span>
            <input type="range" id="zoomSlider" min="1" max="3" step="0.1" class="sidebar__slider" />
          </label>
        </div>
      </div>

      <div class="sidebar__section sidebar__section--advanced">
        <h5 class="sidebar__title">Guía de Movimiento</h5>
        <button class="sidebar__btn sidebar__btn--toggle" id="guideToggle" title="Activar ruta de animación">
          <span class="sidebar__icon">🎢</span>
          <span class="sidebar__label">Activar Guía</span>
        </button>
        <div class="sidebar__control sidebar__control--sub" id="guideControls" hidden>
          <label class="sidebar__label-inline">
            <span>Inicio (frame)</span>
            <input type="number" id="guideStartFrame" min="0" value="0" class="sidebar__input-number" />
          </label>
          <label class="sidebar__label-inline">
            <span>Duración</span>
            <input type="number" id="guideDuration" min="1" value="12" class="sidebar__input-number" />
          </label>
          <label class="sidebar__label-inline sidebar__label-inline--stack">
            <span>Timing (Easing)</span>
            <select id="guideEasing" class="sidebar__select">
              <option value="linear">Lineal constante</option>
              <option value="ease-in">Acelerar (Ease In)</option>
              <option value="ease-out">Decelerar (Ease Out)</option>
              <option value="ease-in-out" selected>Suave (Ease In-Out)</option>
            </select>
          </label>
        </div>
      </div>

      <div class="sidebar__section sidebar__section--advanced">
        <h5 class="sidebar__title">Overlays</h5>
        <button class="sidebar__btn sidebar__btn--toggle" id="drawingToggle" title="Dibujar a mano alzada">
          <span class="sidebar__icon">✏️</span>
          <span class="sidebar__label">Dibujar</span>
        </button>
        <button class="sidebar__btn" id="addText" title="Añadir texto al frame">
          <span class="sidebar__icon">📝</span>
          <span class="sidebar__label">Texto</span>
        </button>
        <button class="sidebar__btn" id="clearOverlays" title="Limpiar overlays pendientes">
          <span class="sidebar__icon">🗑️</span>
          <span class="sidebar__label">Limpiar</span>
        </button>
        <p class="sidebar__helper" id="overlayStatus">Sin overlays pendientes</p>
      </div>

      <div class="sidebar__section">
        <h5 class="sidebar__title">Plantillas aula</h5>
        <button class="sidebar__btn template-btn" data-template="story" title="Historia breve a 4 FPS">
          <span class="sidebar__icon">📚</span>
          <span class="sidebar__label">Historia</span>
        </button>
        <button class="sidebar__btn template-btn" data-template="movement" title="Análisis de movimiento a 8 FPS">
          <span class="sidebar__icon">🏃</span>
          <span class="sidebar__label">Movimiento</span>
        </button>
        <button class="sidebar__btn template-btn" data-template="experiment" title="Experimento o time-lapse">
          <span class="sidebar__icon">🧪</span>
          <span class="sidebar__label">Experimento</span>
        </button>
        <button class="sidebar__btn template-btn" data-template="pictograms" title="Narrativa con pictogramas">
          <span class="sidebar__icon">🖼️</span>
          <span class="sidebar__label">Pictos</span>
        </button>
        <button class="sidebar__btn template-btn" data-template="geometry" title="Geometría y traslaciones">
          <span class="sidebar__icon">📐</span>
          <span class="sidebar__label">Geometría</span>
        </button>
        <button class="sidebar__btn template-btn" data-template="growth" title="Crecimiento y time-lapse automático">
          <span class="sidebar__icon">🌱</span>
          <span class="sidebar__label">Crecimiento</span>
        </button>
        <button class="sidebar__btn template-btn" data-template="art" title="Arte y marcos decorativos">
          <span class="sidebar__icon">🎨</span>
          <span class="sidebar__label">Arte</span>
        </button>
        <p class="sidebar__helper" id="templateStatus">Elige una plantilla para configurar ritmo, ayudas y objetivos.</p>
      </div>

      <div class="sidebar__section sidebar__section--advanced">
        <h5 class="sidebar__title">Auto-captura</h5>
        <div class="auto-capture-controls">
          <button class="sidebar__btn" id="autoCapture3" data-auto-interval="3" title="Captura automática cada 3 segundos">
            <span class="sidebar__icon">⏱️</span>
            <span class="sidebar__label">3 seg</span>
          </button>
          <button class="sidebar__btn" id="autoCapture5" data-auto-interval="5" title="Captura automática cada 5 segundos">
            <span class="sidebar__icon">⏱️</span>
            <span class="sidebar__label">5 seg</span>
          </button>
          <button class="sidebar__btn" id="autoCapture10" data-auto-interval="10" title="Captura automática cada 10 segundos">
            <span class="sidebar__icon">⏱️</span>
            <span class="sidebar__label">10 seg</span>
          </button>
          <button class="sidebar__btn sidebar__btn--danger" id="autoCaptureStop" data-auto-stop="true" title="Detener auto-captura">
            <span class="sidebar__icon">⏹️</span>
            <span class="sidebar__label">Detener</span>
          </button>
        </div>
        <div class="auto-capture__indicator" id="autoCaptureIndicator" data-auto-capture-indicator hidden>
          <span class="auto-capture__label" data-auto-capture-label>⏱️ Auto: 3s</span>
          <span class="auto-capture__countdown">Próxima: <strong id="autoCaptureCountdownValue" data-auto-capture-countdown>3</strong>s</span>
        </div>
      </div>
    </aside>

    <main class="main-stage">
      <div class="video-shell" id="videoShell">
        <div class="video-shell__viewport" id="previewViewport">
          <video id="camera" playsinline muted></video>
          <canvas id="overlay"></canvas>
        </div>
        <div class="alert" id="permissionAlert" hidden>
          Permiso de cámara bloqueado.
        </div>
      </div>

      <div class="stage__actions">
        <button class="btn primary" id="capture">📸 Capturar</button>
        <button class="btn secondary" id="play">▶️ Reproducir</button>
        <button class="btn ghost" id="undo">↩️ Deshacer</button>
        <button class="btn ghost" id="redo">↪️ Rehacer</button>
        <button class="btn ghost beginner-only" id="rotateBeginner" title="Girar cámara">🔄 Girar</button>
        <button class="btn ghost beginner-only" id="mirrorBeginner" title="Espejo">🪞 Espejo</button>
      </div>

      <div class="stage__beginner-tools beginner-only">
        <div class="stage__timer-dock" aria-label="Temporizadores de auto-captura">
          <button class="stage__mini-btn" id="beginnerAutoCapture3" data-auto-interval="3" type="button" title="Captura automática cada 3 segundos">3s</button>
          <button class="stage__mini-btn" id="beginnerAutoCapture5" data-auto-interval="5" type="button" title="Captura automática cada 5 segundos">5s</button>
          <button class="stage__mini-btn" id="beginnerAutoCapture10" data-auto-interval="10" type="button" title="Captura automática cada 10 segundos">10s</button>
          <button class="stage__mini-btn stage__mini-btn--stop" id="beginnerAutoCaptureStop" data-auto-stop="true" type="button" title="Detener auto-captura">Stop</button>
        </div>
        <div class="auto-capture__indicator auto-capture__indicator--floating" data-auto-capture-indicator hidden>
          <span class="auto-capture__label" data-auto-capture-label>⏱️ Auto: 3s</span>
          <span class="auto-capture__countdown">Próxima: <strong data-auto-capture-countdown>3</strong>s</span>
        </div>
      </div>

      <div class="stage__status">
        <span class="stage__status-item" id="frameCount">0 fotogramas</span>
        <span class="stage__status-item" id="projectDuration">0 s</span>
        <p class="stage__status-item"><span>🏋️</span> <span id="projectSize">0 B</span></p>
        <p class="stage__status-item" id="progressSemaphore" data-level="red">🔴 Necesitas más fotos</p>
        <span class="stage__status-item stage__status-item--accent" id="exportStatus"></span>
      </div>

      <div class="stage__insights">
        <article class="insight-card">
          <span class="insight-card__label">Relación tiempo</span>
          <strong id="framesHint">6 fotos = 1 s</strong>
          <p id="pedagogicalHint">Haz cambios pequeños entre fotos para que la animación se vea fluida.</p>
        </article>

        <article class="selected-frame-card" id="selectedFrameCard">
          <div class="selected-frame-card__thumb">
            <img id="selectedFramePreview" alt="Vista previa del fotograma activo" hidden />
            <div class="selected-frame-card__placeholder" id="selectedFramePlaceholder">Sin fotogramas</div>
          </div>
          <div class="selected-frame-card__body">
            <span class="selected-frame-card__eyebrow" id="selectedFrameEyebrow">Fotograma activo</span>
            <strong id="selectedFrameTitle">Captura tu primera imagen</strong>
            <p id="selectedFrameMeta">La selección te permitirá reproducir desde un punto concreto de la timeline.</p>
          </div>
        </article>
      </div>
    </main>

    <aside class="sidebar sidebar--right">
      <div class="sidebar__section">
        <h5 class="sidebar__title">Exportar</h5>
        <div class="sidebar__control">
          <label class="sidebar__label-inline sidebar__label-inline--stack">
            <span class="sidebar__icon">📐</span>
            <span>Resolución</span>
            <select id="exportResolution" class="sidebar__select" title="Resolución de exportación">
              <option value="original">Original</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </label>
        </div>
        <button class="sidebar__btn sidebar__btn--accent" id="exportWebm" title="Exportar vídeo WebM">
          <span class="sidebar__icon">🎬</span>
          <span class="sidebar__label">WebM</span>
        </button>
        <button class="sidebar__btn" id="exportZip" title="Exportar secuencia ZIP">
          <span class="sidebar__icon">🗜️</span>
          <span class="sidebar__label">ZIP</span>
        </button>
        <button class="sidebar__btn sidebar__section--advanced" id="exportJson" title="Guardar proyecto JSON">
          <span class="sidebar__icon">💾</span>
          <span class="sidebar__label">JSON</span>
        </button>
        <button class="sidebar__btn sidebar__section--advanced" id="exportNdjson" title="Exportar NDJSON">
          <span class="sidebar__icon">📄</span>
          <span class="sidebar__label">NDJSON</span>
        </button>
        <p class="sidebar__helper" id="exportEstimate">Duración 0 s · Resolución original</p>
      </div>

      <div class="sidebar__section sidebar__section--advanced">
        <h5 class="sidebar__title">Plantillas analógicas</h5>
        <button class="sidebar__btn" id="exportZootrope" title="Generar plantilla zootropo A4">
          <span class="sidebar__icon">🌀</span>
          <span class="sidebar__label">Zootropo</span>
        </button>
        <button class="sidebar__btn" id="exportPhenakistoscope" title="Generar plantilla fenakistiscopio A4">
          <span class="sidebar__icon">⭕</span>
          <span class="sidebar__label">Fenakist.</span>
        </button>
      </div>

      <div class="sidebar__section">
        <h5 class="sidebar__title">Proyecto</h5>
        <button class="sidebar__btn" id="importProject" title="Importar proyecto">
          <span class="sidebar__icon">📂</span>
          <span class="sidebar__label">Importar</span>
        </button>
        <button class="sidebar__btn sidebar__btn--danger" id="reset" title="Borrar proyecto actual">
          <span class="sidebar__icon">🗑️</span>
          <span class="sidebar__label">Borrar</span>
        </button>
        <button class="sidebar__btn sidebar__section--advanced" id="purge" title="Limpiar toda la caché local">
          <span class="sidebar__icon">🧹</span>
          <span class="sidebar__label">Purgar</span>
        </button>
      </div>

      <div class="sidebar__section sidebar__section--advanced">
        <h5 class="sidebar__title">Expansiones premium</h5>
        <p class="sidebar__helper">Arquitectura preparada para sincronización, audio, chroma, MP4, HD+, galería y colaboración.</p>
        <div class="premium-grid" id="premiumFeatureGrid"></div>
      </div>

      <div class="sidebar__section">
        <h5 class="sidebar__title">Pictogramas</h5>
        <button class="sidebar__btn sidebar__btn--accent" id="openPictoModal" title="Abrir selector de pictogramas">
          <span class="sidebar__icon">🖼️</span>
          <span class="sidebar__label">Buscar</span>
        </button>
        <p class="sidebar__helper" id="pictoStatus">Catálogo local listo</p>
      </div>
    </aside>
  </div>

  <section class="timeline">
    <div class="timeline__track" id="timeline"></div>
  </section>

  <section class="panel guide">
    <h3>Guía rápida y accesibilidad</h3>
    <ul>
      <li><strong>Captura:</strong> usa ↻ para girar y 🪞 para espejo. La timeline superior te enseña segundos reales.</li>
      <li><strong>Tempo:</strong> a 4 FPS, 4 fotos hacen 1 segundo. A 8 FPS, necesitarás 8.</li>
      <li><strong>Edición:</strong> pulsa en cualquier frame para seleccionarlo, reproducir desde ahí o arrastrarlo.</li>
      <li><strong>Exporta:</strong> WebM para vídeo, ZIP para secuencia, JSON/NDJSON para guardar el proyecto.</li>
      <li><strong>Privacidad:</strong> todo queda en el dispositivo salvo que actives búsqueda remota de pictogramas.</li>
    </ul>

    <details open>
      <summary>⌨️ Atajos de teclado</summary>
      <div class="shortcuts-grid">
        <p><kbd>Espacio</kbd> / <kbd>Enter</kbd> / <kbd>C</kbd> / <kbd>F</kbd> → Capturar fotograma</p>
        <p><kbd>P</kbd> → Reproducir o pausar desde el frame seleccionado</p>
        <p><kbd>←</kbd> / <kbd>→</kbd> → Mover selección entre fotogramas</p>
        <p><kbd>D</kbd> / <kbd>Ctrl+Z</kbd> → Deshacer</p>
        <p><kbd>R</kbd> / <kbd>Ctrl+Shift+Z</kbd> → Rehacer</p>
        <p><kbd>G</kbd> → Alternar rejilla</p>
        <p><kbd>O</kbd> → Alternar Onion Skin</p>
        <p><kbd>L</kbd> → Activar o desactivar bucle</p>
        <p><kbd>M</kbd> → Alternar espejo de cámara</p>
        <p><kbd>B</kbd> → Alternar modo guiado</p>
        <p><kbd>E</kbd> → Exportar a WebM</p>
        <p><kbd>⇧↑</kbd> / <kbd>⇧↓</kbd> → Ajustar FPS</p>
        <p><kbd>⌫</kbd> → Eliminar el fotograma seleccionado</p>
      </div>
    </details>

    <details>
      <summary>❓ Preguntas frecuentes</summary>
      <div class="faq-container">
        <details class="faq-item">
          <summary>¿No funciona la cámara?</summary>
          <div class="faq-content">
            <p>Revisa el candado del navegador y permite el acceso a la cámara. Motion necesita HTTPS o localhost para funcionar correctamente.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary>¿Qué gana esta timeline nueva?</summary>
          <div class="faq-content">
            <p>Ahora ves tiempo real, no solo miniaturas. La línea superior marca segundos y la aguja te dice exactamente dónde estás durante la reproducción.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary>¿Se suben mis datos?</summary>
          <div class="faq-content">
            <p>No. La app sigue siendo offline-first y guarda proyectos localmente. Solo ARASAAC remoto usa red cuando lo activas tú.</p>
          </div>
        </details>
      </div>
    </details>
  </section>

  <input type="file" id="importFile" hidden accept=".json,.ndjson" />

  <div class="modal-overlay" id="pictoModal" hidden>
    <div class="modal picto-modal">
      <header class="modal__header">
        <h2 class="modal__title">🖼️ Pictogramas</h2>
        <button class="modal__close" id="closePictoModal" title="Cerrar">&times;</button>
      </header>
      <div class="modal__body">
        <div class="picto-modal__controls">
          <input type="search" id="pictoSearch" placeholder="Buscar pictograma..." class="picto-modal__search" />
          <label class="picto-modal__checkbox">
            <input type="checkbox" id="pictoRemote" />
            <span>Buscar en ARASAAC online</span>
          </label>
        </div>
        <p class="picto-modal__helper">Click = crear frame completo · Shift+Click = añadir como overlay</p>
        <div class="picto-grid picto-modal__grid" id="pictoGrid"></div>
      </div>
    </div>
  </div>
`

const currentYear = new Date().getFullYear()
const footer = document.createElement('footer')
footer.className = 'edumind-footer'
footer.innerHTML = `
  <div class="footer-content">
    <div class="footer-brand">
      <a href="https://losmundosedufis.com" target="_blank" rel="noopener noreferrer" class="footer-logo-link">
        <img src="./icons/logo_LME_def.webp" alt="Los Mundos Edufis" class="footer-logo" />
        <span>Los Mundos Edufis</span>
      </a>
      <p class="footer-text">
        Código abierto en
        <a href="https://github.com/edumind-es/motion-stopmotion" target="_blank" rel="noopener noreferrer">GitHub</a>
      </p>
    </div>

    <div class="footer-links">
      <a href="https://edumind.es/privacidad" target="_blank" rel="noopener noreferrer">Privacidad</a>
      <span class="separator">|</span>
      <a href="https://edumind.es/legal" target="_blank" rel="noopener noreferrer">Aviso legal</a>
      <span class="separator">|</span>
      <a href="https://edumind.es/terminos" target="_blank" rel="noopener noreferrer">Términos de uso</a>
      <span class="separator">|</span>
      <a href="https://donar.edumind.es" target="_blank" rel="noopener noreferrer" class="donate-link">💚 Apoyar</a>
    </div>

    <div class="footer-meta">
      <p>© ${currentYear} EDUmind por <strong>Luis Vilela Acuña</strong></p>
      <div class="footer-badges">
        <span class="badge version-badge">v${APP_VERSION}</span>
        <a href="https://github.com/edumind-es/motion-stopmotion/issues" class="badge feedback-badge" target="_blank" rel="noopener noreferrer">
          📋 Reportar error
        </a>
      </div>
    </div>
  </div>
`
document.body.appendChild(footer)

// Floating mode toggle (visible in both modes)
const modeToggle = document.createElement('button')
modeToggle.className = 'beginner-mode-toggle'
modeToggle.id = 'floatingModeToggle'
modeToggle.innerHTML = `<span class="beginner-mode-toggle__icon">🧭</span> <span id="floatingModeLabel">Modo pro</span>`
document.body.appendChild(modeToggle)

// Botón flotante de guardado — solo visible en modo aula para el maestro
const teacherSaveBtn = document.createElement('button')
teacherSaveBtn.className = 'teacher-save-btn'
teacherSaveBtn.id = 'teacherSaveBtn'
teacherSaveBtn.title = 'Guardar copia de seguridad del proyecto'
teacherSaveBtn.innerHTML = `<span class="teacher-save-btn__icon">💾</span><span class="teacher-save-btn__label">Guardar</span>`
document.body.appendChild(teacherSaveBtn)

// Welcome screen overlay (general, for mode selection)
const welcomeOverlay = document.createElement('div')
welcomeOverlay.className = 'welcome-overlay'
welcomeOverlay.id = 'welcomeOverlay'
welcomeOverlay.hidden = true
welcomeOverlay.innerHTML = `
  <div class="welcome-overlay__content">
    <img src="./icons/logo-motion.png" alt="Motion EDUmind" class="welcome-overlay__logo" />
    <h1 class="welcome-overlay__title">Motion EDUmind</h1>
    <p class="welcome-overlay__subtitle">Un set stopmotion oscuro, limpio y táctil para aula o creación avanzada. Elige tu forma de trabajar y entra directo a capturar.</p>
    <div class="welcome-overlay__modes">
      <button class="welcome-overlay__mode-btn welcome-overlay__mode-btn--aula" id="welcomeModeAula">
        <span class="welcome-overlay__mode-icon">🎓</span>
        <span class="welcome-overlay__mode-title">Modo Aula</span>
        <span class="welcome-overlay__mode-desc">Pantalla completa, botones físicos grandes, filmstrip sencillo y foco total en capturar.</span>
      </button>
      <button class="welcome-overlay__mode-btn welcome-overlay__mode-btn--pro" id="welcomeModePro">
        <span class="welcome-overlay__mode-icon">🧭</span>
        <span class="welcome-overlay__mode-title">Modo Pro</span>
        <span class="welcome-overlay__mode-desc">Timeline completa, exportaciones, ajustes finos y laboratorio de funciones avanzadas.</span>
      </button>
    </div>
  </div>
`
document.body.appendChild(welcomeOverlay)

const ssoBtn = document.getElementById('ssoBtn') as HTMLButtonElement
authManager.subscribe((isAuthenticated) => {
  if (isAuthenticated) {
    ssoBtn.textContent = 'Mi cuenta'
    ssoBtn.onclick = () => { window.location.href = authManager.getShellUrl() }
  } else {
    ssoBtn.textContent = 'Iniciar sesión'
    ssoBtn.onclick = () => authManager.login()
  }
})

const videoEl = document.getElementById('camera') as HTMLVideoElement
const videoShellEl = document.getElementById('videoShell') as HTMLElement
const previewViewportEl = document.getElementById('previewViewport') as HTMLElement
const overlayCanvas = document.getElementById('overlay') as HTMLCanvasElement
const timelineEl = document.getElementById('timeline') as HTMLElement
const cameraSelect = document.getElementById('cameraSelect') as HTMLSelectElement
const pictoGrid = document.getElementById('pictoGrid') as HTMLElement
const pictoSearch = document.getElementById('pictoSearch') as HTMLInputElement
const pictoRemoteToggle = document.getElementById('pictoRemote') as HTMLInputElement
const pictoStatus = document.getElementById('pictoStatus') as HTMLElement
const importFileInput = document.getElementById('importFile') as HTMLInputElement
const exportStatusEl = document.getElementById('exportStatus') as HTMLElement
const frameCountEl = document.getElementById('frameCount') as HTMLElement
const projectDurationEl = document.getElementById('projectDuration') as HTMLElement
const projectSizeEl = document.getElementById('projectSize') as HTMLElement
const permissionAlert = document.getElementById('permissionAlert') as HTMLElement
const fpsValueEl = document.getElementById('fpsValue') as HTMLElement
const framesHintEl = document.getElementById('framesHint') as HTMLElement
const pedagogicalHintEl = document.getElementById('pedagogicalHint') as HTMLElement
const selectedFramePreviewEl = document.getElementById('selectedFramePreview') as HTMLImageElement
const selectedFramePlaceholderEl = document.getElementById('selectedFramePlaceholder') as HTMLElement
const selectedFrameTitleEl = document.getElementById('selectedFrameTitle') as HTMLElement
const selectedFrameMetaEl = document.getElementById('selectedFrameMeta') as HTMLElement
const selectedFrameEyebrowEl = document.getElementById('selectedFrameEyebrow') as HTMLElement
const exportResolutionEl = document.getElementById('exportResolution') as HTMLSelectElement
const exportEstimateEl = document.getElementById('exportEstimate') as HTMLElement
const loopToggleEl = document.getElementById('loopToggle') as HTMLButtonElement
const uiModeToggleEl = document.getElementById('uiModeToggle') as HTMLButtonElement
const uiModeStatusEl = document.getElementById('uiModeStatus') as HTMLElement
const templateStatusEl = document.getElementById('templateStatus') as HTMLElement
const premiumFeatureGridEl = document.getElementById('premiumFeatureGrid') as HTMLElement
const playButtonEl = document.getElementById('play') as HTMLButtonElement
const captureButtonEl = document.getElementById('capture') as HTMLButtonElement
const fpsInputEl = document.getElementById('fps') as HTMLInputElement
const onionOpacityEl = document.getElementById('onionOpacity') as HTMLInputElement
const zoomSliderEl = document.getElementById('zoomSlider') as HTMLInputElement
const undoButtonEl = document.getElementById('undo') as HTMLButtonElement
const redoButtonEl = document.getElementById('redo') as HTMLButtonElement

const guideToggleEl = document.getElementById('guideToggle') as HTMLButtonElement
const guideControlsEl = document.getElementById('guideControls') as HTMLElement
const guideStartFrameEl = document.getElementById('guideStartFrame') as HTMLInputElement
const guideDurationEl = document.getElementById('guideDuration') as HTMLInputElement
const guideEasingEl = document.getElementById('guideEasing') as HTMLSelectElement

const drawingToggleEl = document.getElementById('drawingToggle') as HTMLButtonElement

previewViewportEl.dataset.mode = 'live'

const camera = new CameraManager(videoEl)
const ui = new UIManager(overlayCanvas)
const overlayManager = new OverlayManager()
overlayManager.setPreviewCanvas(overlayCanvas)
const motionGuide = new MotionGuideManager(overlayCanvas)
const drawingManager = new DrawingManager(overlayCanvas, overlayManager)

let pictoItems: PictoItem[] = []
let remotePictoItems: PictoItem[] = []
let remoteSearchTimer: number | undefined
let exportStatusTimer: number | undefined

let playing = false
let scrubbing = false
let playbackRaf = 0
let playbackStartTime = 0
let playbackStartOffsetMs = 0
let playbackCurrentPositionMs = 0
let playbackRenderedFrameId: string | null = null
let drawFrameToken = 0
let playbackFrames: FrameData[] = []
let playbackMetrics = buildTimelineMetrics([], { fps: 1 })
let playbackSettings: Pick<ProjectSettings, 'fps' | 'loopPlayback'> | null = null
let playbackTotalDurationMs = 0
let exportersPromise: Promise<ExportersModule> | null = null
let autoCaptureInterval: ReturnType<typeof setInterval> | null = null
let autoCaptureCountdown: ReturnType<typeof setInterval> | null = null
let autoCaptureActiveInterval: AutoCaptureIntervalSeconds | null = null

function isLocalCameraHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost')
}

function renderPremiumFeatureGrid() {
  if (!premiumFeatureGridEl) return
  const tier = authManager.getTier()

  premiumFeatureGridEl.innerHTML = PREMIUM_FEATURES.map((feature) => {
    const accessible = checkAccess(feature.key, tier)
    return `
      <button
        class="premium-card${accessible ? ' premium-card--available' : ''}"
        type="button"
        data-premium-feature="${feature.key}"
        aria-label="${feature.name}"
      >
        <span class="premium-card__icon">${feature.icon}</span>
        <span class="premium-card__title">${feature.name}</span>
        <span class="premium-card__desc">${feature.description}</span>
        <span class="premium-card__meta">${accessible ? 'Preparado' : 'Premium'}</span>
      </button>
    `
  }).join('')

  premiumFeatureGridEl.querySelectorAll<HTMLElement>('[data-premium-feature]').forEach((button) => {
    button.onclick = () => {
      const key = button.dataset.premiumFeature as PremiumFeatureKey | undefined
      if (!key) return

      if (!checkAccess(key, tier)) {
        setExportStatus(getPremiumUpsellMessage(key), true)
        return
      }

      setExportStatus('Arquitectura preparada. Esta función llegará en una siguiente fase.', true)
    }
  })
}

const timeline = new TimelineManager(timelineEl, {
  onReorder: (from, to) => store.moveFrame(from, to),
  onRemove: (id) => store.removeFrame(id),
  onDuplicate: (id) => { void store.duplicateFrame(id) },
  onSelect: (id) => {
    if (playing) stopPlayback()
    store.selectFrame(id)
  },
  onScrubStart: () => {
    scrubbing = true
    if (playing) stopPlayback({ restoreOverlay: false, syncSelection: false })
  },
  onScrub: (positionMs) => previewTimelinePosition(positionMs),
  onScrubEnd: (positionMs) => {
    scrubbing = false
    store.setPlaybackPosition(positionMs, true)
    restoreIdleOverlay()
  },
  onZoomChange: (zoom) => store.setTimelineZoom(zoom)
})

function persistSettingsDefaults() {
  localStorage.setItem('motion_defaults', JSON.stringify(store.getState().settings))
}

function applyAulaDefaults() {
  const mg = store.getState().settings.motionGuide
  store.updateSettings({
    uiMode: 'beginner',
    onionEnabled: true,
    onionOpacity: 0.32,
    motionGuide: { ...mg, enabled: false }
  })
  persistSettingsDefaults()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function loadExporters() {
  exportersPromise ||= import('./exporters')
  return await exportersPromise
}

function setExportStatus(message: string, keepVisible = false) {
  exportStatusEl.textContent = message
  if (exportStatusTimer) window.clearTimeout(exportStatusTimer)
  if (!keepVisible && message) {
    exportStatusTimer = window.setTimeout(() => {
      exportStatusEl.textContent = ''
    }, EXPORT_STATUS_CLEAR_MS)
  }
}

function ensureFrameCapacity() {
  const frameCount = store.getState().frames.length
  if (frameCount >= MAX_FRAME_COUNT) {
    setExportStatus(`Límite alcanzado: ${MAX_FRAME_COUNT} fotogramas`, true)
    return false
  }
  return true
}

function getSelectedMetric(state: ProjectState) {
  if (!state.selectedFrameId) return null
  const metrics = buildTimelineMetrics(state.frames, state.settings)
  return metrics.find((metric) => metric.id === state.selectedFrameId) || null
}

async function drawFrameOnOverlay(frame: FrameData) {
  const token = ++drawFrameToken
  if (overlayCanvas.width === 0 || overlayCanvas.height === 0) {
    overlayCanvas.width = frame.width
    overlayCanvas.height = frame.height
  }

  const ctx = overlayCanvas.getContext('2d')!
  const bitmap = await createImageBitmap(frame.blob)

  if (token !== drawFrameToken) {
    bitmap.close()
    return
  }

  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  ctx.drawImage(bitmap, 0, 0, overlayCanvas.width, overlayCanvas.height)
  bitmap.close()
  
  motionGuide.render()
}

async function restoreIdleOverlay() {
  drawFrameToken += 1
  const token = drawFrameToken
  playbackRenderedFrameId = null
  const state = store.getState()
  await ui.updateOverlay(state.settings, state.frames.at(-1) || null, false)
  if (token === drawFrameToken && state.settings.uiMode !== 'beginner') {
    motionGuide.render()
  }
}

function renderSelectionCard(frame: FrameData | null, index: number, total: number, startMs: number, eyebrow: string) {
  if (!frame) {
    selectedFramePreviewEl.hidden = true
    selectedFramePlaceholderEl.hidden = false
    selectedFrameEyebrowEl.textContent = 'Fotograma activo'
    selectedFrameTitleEl.textContent = 'Captura tu primera imagen'
    selectedFrameMetaEl.textContent = 'La selección te permitirá reproducir desde un punto concreto de la timeline.'
    return
  }

  selectedFramePreviewEl.hidden = false
  selectedFramePreviewEl.src = frame.objectUrl
  selectedFramePlaceholderEl.hidden = true
  selectedFrameEyebrowEl.textContent = eyebrow
  selectedFrameTitleEl.textContent = `${index + 1} / ${total}${frame.label ? ` · ${frame.label}` : ''}`
  selectedFrameMetaEl.textContent = `${formatDurationMs(startMs)} · ${frame.source === 'picto' ? 'Pictograma' : 'Cámara'} · ${frame.width}×${frame.height}`
}

function renderSelectionFromState(state: ProjectState) {
  const selectedFrame = getSelectedFrame(state.frames, state.selectedFrameId)
  const metric = getSelectedMetric(state)

  if (!selectedFrame || !metric) {
    renderSelectionCard(null, 0, state.frames.length, 0, 'Fotograma activo')
    return
  }

  renderSelectionCard(selectedFrame, metric.index, state.frames.length, metric.startMs, 'Fotograma seleccionado')
}

function renderPedagogicalHint(state: ProjectState) {
  const neededFrames = getFramesNeededForOneSecond(state.settings)
  const totalDuration = getTotalDurationMs(state.frames.length, state.settings)
  framesHintEl.textContent = `${neededFrames} fotos = 1 s · ${state.frames.length} fotos = ${formatDurationMs(totalDuration)}`

  if (state.settings.uiMode === 'beginner') {
    pedagogicalHintEl.textContent = state.frames.length === 0
      ? `Empieza con ${neededFrames} fotos para completar el primer segundo de animación.`
      : `Vas por ${formatDurationMs(totalDuration)}. Mantén cambios pequeños y regulares entre fotos.`
    return
  }

  pedagogicalHintEl.textContent = state.frames.length === 0
    ? `Elige un ritmo de ${state.settings.fps} FPS y define primero cuánto durará la escena.`
    : `La timeline temporal te permite comprobar si la duración final encaja con el ritmo narrativo.`
}

function renderDerivedState(state: ProjectState) {
  const totalDuration = getTotalDurationMs(state.frames.length, state.settings)
  const sizeBytes = getProjectByteSize(state.frames)

  frameCountEl.textContent = `${state.frames.length} fotogramas`
  projectDurationEl.textContent = formatDurationMs(totalDuration)
  projectSizeEl.textContent = formatBytes(sizeBytes)
  fpsValueEl.textContent = `${state.settings.fps} FPS`
  exportEstimateEl.textContent = `${formatDurationMs(totalDuration)} · ${state.settings.exportResolution}`
  exportResolutionEl.value = state.settings.exportResolution

  if (document.activeElement !== fpsInputEl) fpsInputEl.value = String(state.settings.fps)
  if (document.activeElement !== onionOpacityEl) onionOpacityEl.value = String(state.settings.onionOpacity)
  if (document.activeElement !== zoomSliderEl) zoomSliderEl.value = String(state.settings.zoom)

  document.body.dataset.uiMode = state.settings.uiMode
  document.body.dataset.playback = state.isPlaying ? 'playing' : 'idle'
  document.body.dataset.welcome = welcomeDismissed ? 'off' : 'on'
  uiModeToggleEl.querySelector('.sidebar__label')!.textContent = state.settings.uiMode === 'advanced' ? 'Modo pro' : 'Modo aula'
  uiModeStatusEl.textContent = state.settings.uiMode === 'advanced'
    ? 'Vista completa activa para editar y exportar.'
    : 'Vista guiada activa con menos controles y ayudas pedagógicas.'

  // Update Motion Guide UI
  const { motionGuide: mg } = state.settings
  guideToggleEl.classList.toggle('active', mg.enabled)
  guideControlsEl.hidden = !mg.enabled
  if (document.activeElement !== guideStartFrameEl) guideStartFrameEl.value = String(mg.startFrame)
  if (document.activeElement !== guideDurationEl) guideDurationEl.value = String(mg.durationFrames)
  if (document.activeElement !== guideEasingEl) guideEasingEl.value = mg.easing

  // Update floating mode toggle
  const floatingLabel = document.getElementById('floatingModeLabel')
  if (floatingLabel) {
    floatingLabel.textContent = state.settings.uiMode === 'advanced' ? 'Modo aula' : '🔒 Modo pro'
  }

  // Show/hide welcome screen (general, for all new users)
  const welcomeEl = document.getElementById('welcomeOverlay')
  if (welcomeEl) {
    welcomeEl.hidden = welcomeDismissed
  }

  // Show/hide beginner-only buttons
  document.querySelectorAll<HTMLElement>('.beginner-only').forEach((el) => {
    el.style.display = state.settings.uiMode === 'beginner' ? '' : 'none'
  })

  loopToggleEl.classList.toggle('active', state.settings.loopPlayback)
  loopToggleEl.querySelector('.sidebar__label')!.textContent = state.settings.loopPlayback ? 'Bucle on' : 'Bucle off'
  playButtonEl.textContent = state.isPlaying ? '⏸️ Pausar' : '▶️ Reproducir'

  const onionToggle = document.getElementById('onionToggle') as HTMLButtonElement
  onionToggle.classList.toggle('active', state.settings.onionEnabled)

  const gridToggle = document.getElementById('gridToggle') as HTMLButtonElement
  gridToggle.classList.toggle('active', state.settings.gridEnabled)

  document.getElementById('rotate')?.classList.toggle('active', state.settings.invertCapture)
  document.getElementById('mirror')?.classList.toggle('active', state.settings.mirrorPreview)
  document.getElementById('rotateBeginner')?.classList.toggle('active', state.settings.invertCapture)
  document.getElementById('mirrorBeginner')?.classList.toggle('active', state.settings.mirrorPreview)

  updateProgressSemaphore(state.frames.length, state.settings)
  renderPedagogicalHint(state)
  renderSelectionFromState(state)
}

function renderTransforms(state: ProjectState) {
  const transforms: string[] = []
  if (state.settings.zoom && state.settings.zoom !== 1) transforms.push(`scale(${state.settings.zoom})`)
  if (state.settings.mirrorPreview) transforms.push('scaleX(-1)')
  if (state.settings.invertCapture) transforms.push('rotate(180deg)')
  videoEl.style.transform = transforms.join(' ') || 'none'
}

function renderState(state: ProjectState) {
  timeline.render({
    frames: state.frames,
    settings: state.settings,
    selectedFrameId: state.selectedFrameId,
    playbackPositionMs: state.playbackPositionMs,
    timelineZoom: state.timelineZoom,
    isPlaying: state.isPlaying,
    uiMode: state.settings.uiMode
  })

  renderDerivedState(state)
  renderTransforms(state)

  if (!playing && !scrubbing) {
    restoreIdleOverlay()
  }
}

async function initCamera() {
  const lastCam = localStorage.getItem('motion_camera')
  let started = await camera.start(lastCam || undefined)

  if (!started && lastCam) {
    started = await camera.start()
  }

  if (!started) {
    permissionAlert.hidden = false
    permissionAlert.textContent = location.protocol === 'https:' || isLocalCameraHost(location.hostname)
      ? 'No se ha podido iniciar la cámara. Revisa permisos, dispositivo disponible o el selector de cámara.'
      : 'Activa HTTPS o usa localhost/127.0.0.1 en desarrollo para habilitar la cámara.'
    return
  }

  const waitForVideo = () => new Promise<void>((resolve) => {
    if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      resolve()
    } else {
      videoEl.addEventListener('loadedmetadata', () => resolve(), { once: true })
      setTimeout(() => resolve(), 2000)
    }
  })

  await waitForVideo()
  permissionAlert.hidden = true

  const devices = await camera.getDevices()
  cameraSelect.innerHTML = ''

  if (devices.length === 0) {
    const option = document.createElement('option')
    option.textContent = 'Cámara predeterminada'
    cameraSelect.appendChild(option)
  }

  devices.forEach((device) => {
    const option = document.createElement('option')
    option.value = device.deviceId
    option.textContent = device.label || `Cámara ${cameraSelect.options.length + 1}`
    cameraSelect.appendChild(option)
  })

  if (lastCam && devices.some((device) => device.deviceId === lastCam)) {
    cameraSelect.value = lastCam
  }

  if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
    overlayCanvas.width = videoEl.videoWidth
    overlayCanvas.height = videoEl.videoHeight
  }
}

function updateOverlayStatus() {
  const overlayStatusEl = document.getElementById('overlayStatus') as HTMLElement
  const count = overlayManager.count()

  if (count === 0) {
    overlayStatusEl.textContent = 'Sin overlays pendientes'
    overlayStatusEl.className = 'sidebar__helper'
    return
  }

  overlayStatusEl.textContent = `✅ ${count} overlay${count > 1 ? 's' : ''} listo${count > 1 ? 's' : ''} para captura`
  overlayStatusEl.className = 'sidebar__helper overlay-active'
}

function applyTemplate(template: string) {
  const templateMap: Record<string, {
    patch: Partial<ProjectSettings>
    message: string
    openPictos?: boolean
    autoCaptureSeconds?: AutoCaptureIntervalSeconds
  }> = {
    story: {
      patch: { fps: 4, onionEnabled: true, gridEnabled: false, uiMode: 'beginner' },
      message: 'Historia breve: 4 FPS, onion activado y enfoque narrativo.'
    },
    movement: {
      patch: { fps: 8, onionEnabled: true, gridEnabled: true, uiMode: 'advanced' },
      message: 'Movimiento: 8 FPS con rejilla y onion para analizar cambios finos.'
    },
    experiment: {
      patch: { fps: 3, onionEnabled: false, gridEnabled: true, uiMode: 'beginner' },
      message: 'Experimento: ritmo lento para observar transformaciones y procesos.',
      autoCaptureSeconds: 10
    },
    pictograms: {
      patch: { fps: 4, onionEnabled: false, gridEnabled: false, uiMode: 'beginner' },
      message: 'Narrativa con pictogramas: 4 FPS y acceso rápido al catálogo visual.',
      openPictos: true
    },
    geometry: {
      patch: { fps: 5, onionEnabled: false, gridEnabled: true, uiMode: 'beginner' },
      message: 'Geometría: rejilla activa y ritmo medio para explorar giros, traslaciones y simetrías.'
    },
    growth: {
      patch: { fps: 2, onionEnabled: false, gridEnabled: true, uiMode: 'beginner' },
      message: 'Crecimiento: time-lapse suave con auto-captura lista para plantas, sombras o procesos lentos.',
      autoCaptureSeconds: 5
    },
    art: {
      patch: { fps: 4, onionEnabled: true, gridEnabled: false, uiMode: 'beginner' },
      message: 'Arte: compón por capas, conserva el onion y captura cambios plásticos pequeños.'
    }
  }

  const config = templateMap[template]
  if (!config) return

  store.updateSettings(config.patch)
  if (config.autoCaptureSeconds) {
    startAutoCapture(config.autoCaptureSeconds)
  } else if (autoCaptureActiveInterval) {
    stopAutoCapture()
  }
  persistSettingsDefaults()
  templateStatusEl.textContent = config.message

  if (config.openPictos) {
    ;(document.getElementById('pictoModal') as HTMLElement).hidden = false
  }
}

function previewTimelinePosition(positionMs: number) {
  const state = store.getState()
  if (!state.frames.length) return

  const metrics = buildTimelineMetrics(state.frames, state.settings)
  const index = getFrameIndexAtTime(state.frames.length, state.settings, positionMs)
  const metric = metrics[index]
  const frame = state.frames[index]
  if (!frame || !metric) return

  timeline.setPlaybackPosition(positionMs, true)
  if (playbackRenderedFrameId !== frame.id) {
    playbackRenderedFrameId = frame.id
    void drawFrameOnOverlay(frame)
  }
  renderSelectionCard(frame, metric.index, state.frames.length, metric.startMs, 'Previsualizando timeline')
}

function preparePlayback() {
  const state = store.getState()
  playbackFrames = [...state.frames]
  playbackMetrics = buildTimelineMetrics(playbackFrames, state.settings)
  playbackSettings = {
    fps: state.settings.fps,
    loopPlayback: state.settings.loopPlayback
  }
  playbackTotalDurationMs = getTotalDurationMs(playbackFrames.length, state.settings)
  videoShellEl.dataset.playback = 'playing'
  previewViewportEl.dataset.mode = 'playback'
  videoEl.style.opacity = '0'
  videoEl.style.visibility = 'hidden'
  videoEl.style.pointerEvents = 'none'
}

function stopPlayback(options: { restoreOverlay?: boolean; syncSelection?: boolean; finalPositionMs?: number } = {}) {
  if (playbackRaf) {
    cancelAnimationFrame(playbackRaf)
    playbackRaf = 0
  }

  const finalPositionMs = options.finalPositionMs ?? playbackCurrentPositionMs
  const restoreOverlay = options.restoreOverlay ?? true
  const syncSelection = options.syncSelection ?? true

  playing = false
  playbackRenderedFrameId = null
  store.setPlaying(false)

  if (syncSelection && playbackFrames.length > 0 && playbackSettings) {
    store.setPlaybackPosition(finalPositionMs, true)
  }

  playbackFrames = []
  playbackMetrics = buildTimelineMetrics([], { fps: 1 })
  playbackSettings = null
  playbackTotalDurationMs = 0

  if (restoreOverlay) {
    restoreIdleOverlay()
  }
  delete videoShellEl.dataset.playback
  previewViewportEl.dataset.mode = 'live'
  videoEl.style.opacity = '1'
  videoEl.style.visibility = 'visible'
  videoEl.style.pointerEvents = ''

  if (!syncSelection) {
    renderSelectionFromState(store.getState())
  }
}

function runPlayback(now: number) {
  if (!playing || !playbackSettings || playbackFrames.length === 0) return

  let nextPositionMs = playbackStartOffsetMs + (now - playbackStartTime)
  if (nextPositionMs >= playbackTotalDurationMs) {
    if (playbackSettings.loopPlayback) {
      playbackStartTime = now
      playbackStartOffsetMs = 0
      nextPositionMs = 0
    } else {
      stopPlayback({
        finalPositionMs: Math.max(0, playbackTotalDurationMs - 1)
      })
      return
    }
  }

  playbackCurrentPositionMs = nextPositionMs
  const frameIndex = getFrameIndexAtTime(playbackFrames.length, playbackSettings, nextPositionMs)
  const metric = playbackMetrics[frameIndex]
  const frame = playbackFrames[frameIndex]

  timeline.setPlaybackPosition(nextPositionMs, true)

  if (frame && metric) {
    if (playbackRenderedFrameId !== frame.id) {
      playbackRenderedFrameId = frame.id
      void drawFrameOnOverlay(frame)
    }
    renderSelectionCard(frame, metric.index, playbackFrames.length, metric.startMs, 'Reproduciendo')
  }

  playbackRaf = requestAnimationFrame(runPlayback)
}

function startPlayback() {
  const state = store.getState()
  if (!state.frames.length) {
    setExportStatus('Añade fotogramas antes de reproducir')
    return
  }

  if (autoCaptureActiveInterval) {
    stopAutoCapture()
  }

  preparePlayback()

  const selectedMetric = getSelectedMetric(state)
  playbackStartOffsetMs = selectedMetric ? selectedMetric.startMs : state.playbackPositionMs
  playbackCurrentPositionMs = playbackStartOffsetMs
  playbackStartTime = performance.now()
  playbackRenderedFrameId = null
  playing = true
  store.setPlaying(true)

  previewTimelinePosition(playbackStartOffsetMs)
  playbackRaf = requestAnimationFrame(runPlayback)
}

async function captureFrame() {
  if (!ensureFrameCapacity()) return
  if (playing) stopPlayback()

  const canvas = document.createElement('canvas')
  const settings = store.getState().settings
  const blob = await camera.capture(canvas, {
    invert: settings.invertCapture,
    mirror: settings.mirrorPreview,
    zoom: settings.zoom
  })

  if (!blob) return

  const overlays = overlayManager.popOverlaysForCapture()
  let finalBlob = blob

  if (overlays.length > 0) {
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const ctx = tempCanvas.getContext('2d')!

    const image = await createImageBitmap(blob)
    ctx.drawImage(image, 0, 0)
    image.close()

    await overlayManager.paintOverlays(ctx, overlays, tempCanvas.width, tempCanvas.height)
    finalBlob = await new Promise<Blob>((resolve, reject) => {
      tempCanvas.toBlob((value) => {
        if (!value) return reject(new Error('Failed to create blob'))
        resolve(value)
      }, 'image/png', 0.92)
    })
  }

  const frame: FrameData = {
    id: Math.random().toString(36).slice(2, 9),
    source: 'camera',
    durationMs: Math.round(1000 / settings.fps),
    width: canvas.width,
    height: canvas.height,
    createdAt: Date.now(),
    blob: finalBlob,
    objectUrl: URL.createObjectURL(finalBlob)
  }

  store.addFrame(frame)
  updateOverlayStatus()
  showCaptureFlash()
  setExportStatus('Fotograma capturado')
  vibrateOnCapture()

  // Show capture counter in beginner mode
  if (store.getState().settings.uiMode === 'beginner') {
    showCaptureCounter(store.getState().frames.length)
  }

  // Update progress semaphore
  updateProgressSemaphore(store.getState().frames.length, store.getState().settings)
}

function maybeSearchRemote(term: string) {
  if (!pictoRemoteToggle.checked || term.length < 3) {
    remotePictoItems = []
    return
  }

  pictoStatus.textContent = 'Buscando en ARASAAC...'
  if (remoteSearchTimer) window.clearTimeout(remoteSearchTimer)

  remoteSearchTimer = window.setTimeout(async () => {
    try {
      remotePictoItems = await searchArasaac(term, 40)
      pictoStatus.textContent = remotePictoItems.length
        ? `ARASAAC: ${remotePictoItems.length} resultados`
        : 'ARASAAC sin resultados'
      renderPictos(term)
    } catch (error) {
      console.error(error)
      pictoStatus.textContent = 'Error consultando ARASAAC. Revisa conexión o permisos.'
    }
  }, 280)
}

function renderPictos(query: string) {
  pictoGrid.innerHTML = ''
  const items = [...pictoItems, ...remotePictoItems]
    .filter((item) => !query || item.label.toLowerCase().includes(query))
    .slice(0, 50)

  items.forEach((item) => {
    const button = document.createElement('button')
    button.className = 'picto'
    button.innerHTML = item.img
      ? `<img src="${item.img}" alt="${item.label}" /><span>${item.label}</span>`
      : `<span class="picto__emoji">${item.emoji || '🖼️'}</span><span>${item.label}</span>`

    button.onclick = async (event) => {
      if (event.shiftKey) {
        overlayManager.addPicto({
          img: item.img,
          emoji: item.emoji || '🖼️',
          label: item.label
        })
        updateOverlayStatus()
        setExportStatus(`Overlay listo: ${item.label}`)
        return
      }

      if (!ensureFrameCapacity()) return
      const blob = await createPictoFrame(item, { width: 1280, height: 720 })
      const frame: FrameData = {
        id: Math.random().toString(36).slice(2, 9),
        source: 'picto',
        label: item.label,
        durationMs: Math.round(1000 / store.getState().settings.fps),
        width: 1280,
        height: 720,
        createdAt: Date.now(),
        blob,
        objectUrl: URL.createObjectURL(blob)
      }

      store.addFrame(frame)
      setExportStatus(`Fotograma creado con ${item.label}`)
    }

    pictoGrid.appendChild(button)
  })
}

async function loadPictos() {
  const catalogs = await loadPictoCatalogs()
  pictoItems = flattenPictoItems(catalogs)
  renderPictos('')
}

function showCaptureFlash() {
  const flash = document.createElement('div')
  flash.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(61, 218, 215, 0.3);
    pointer-events: none;
    z-index: 9999;
    animation: captureFlash 0.3s ease-out forwards;
  `
  document.body.appendChild(flash)
  setTimeout(() => flash.remove(), 300)
}

function showCaptureCounter(count: number) {
  const counter = document.createElement('div')
  counter.className = 'capture-counter'
  counter.textContent = `📸 ${count}`
  document.body.appendChild(counter)
  setTimeout(() => counter.remove(), 700)
}

function updateAutoCaptureControlsState() {
  const active = autoCaptureActiveInterval
  document.querySelectorAll<HTMLElement>('[data-auto-interval], [data-auto-stop="true"]').forEach((button) => {
    const interval = button.dataset.autoInterval ? Number(button.dataset.autoInterval) : null
    const isStop = button.dataset.autoStop === 'true'
    button.classList.toggle('active', Boolean(active && interval === active))
    button.classList.toggle('is-active', Boolean(active && interval === active))
    button.classList.toggle('is-stop-active', Boolean(isStop && active))
  })
}

function updateAutoCaptureIndicators(intervalSeconds: AutoCaptureIntervalSeconds, seconds: number, hidden = false) {
  document.querySelectorAll<HTMLElement>('[data-auto-capture-indicator]').forEach((indicator) => {
    indicator.hidden = hidden
    const label = indicator.querySelector<HTMLElement>('[data-auto-capture-label]')
    const countdown = indicator.querySelector<HTMLElement>('[data-auto-capture-countdown]')
    if (label) label.textContent = `⏱️ Auto: ${intervalSeconds}s`
    if (countdown) countdown.textContent = `${seconds}`
  })
}

function startAutoCapture(intervalSeconds: AutoCaptureIntervalSeconds) {
  stopAutoCapture()
  autoCaptureActiveInterval = intervalSeconds
  let remaining = intervalSeconds
  updateAutoCaptureIndicators(intervalSeconds, remaining)
  updateAutoCaptureControlsState()
  setExportStatus(`Auto-captura iniciada cada ${intervalSeconds} s`, true)

  autoCaptureCountdown = setInterval(() => {
    remaining--
    if (remaining <= 0) remaining = intervalSeconds
    updateAutoCaptureIndicators(intervalSeconds, remaining)
  }, 1000)

  autoCaptureInterval = setInterval(() => {
    void captureFrame()
    remaining = intervalSeconds
    updateAutoCaptureIndicators(intervalSeconds, remaining)
  }, intervalSeconds * 1000)
}

function stopAutoCapture() {
  if (autoCaptureInterval) { clearInterval(autoCaptureInterval); autoCaptureInterval = null }
  if (autoCaptureCountdown) { clearInterval(autoCaptureCountdown); autoCaptureCountdown = null }
  autoCaptureActiveInterval = null
  updateAutoCaptureIndicators(3, 3, true)
  updateAutoCaptureControlsState()
}

function updateProgressSemaphore(frameCount: number, settings: Pick<ProjectSettings, 'fps'>) {
  const el = document.getElementById('progressSemaphore')
  if (!el) return
  const level = getProgressLevel(frameCount, settings)
  el.dataset.level = level
  const icon = level === 'red' ? '🔴' : level === 'yellow' ? '🟡' : '🟢'
  const msg = level === 'red'
    ? `${icon} Necesitas ${getFramesNeededForOneSecond(settings)} fotos para el primer segundo`
    : level === 'yellow'
    ? `${icon} Buen ritmo. Ya tienes material para probar.`
    : `${icon} Listo para reproducir y exportar.`
  el.textContent = msg
}

// Vibration feedback on capture for mobile (Phase 3)
function vibrateOnCapture() {
  if ('vibrate' in navigator) {
    navigator.vibrate(50)
  }
}

let welcomeDismissed = localStorage.getItem('motion_welcome_dismissed') === 'true'

function showKeyboardHint(key: string, action: string) {
  const hint = document.createElement('div')
  hint.className = 'keyboard-hint'
  hint.innerHTML = `<span class="keyboard-hint__key">${key}</span> ${action}`
  hint.style.cssText = `
    position: fixed;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    background: rgba(11, 20, 37, 0.95);
    border: 1px solid rgba(61, 218, 215, 0.4);
    border-radius: 12px;
    padding: 12px 20px;
    color: #f5fbff;
    font-size: 14px;
    font-weight: 600;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 12px 32px rgba(4, 10, 28, 0.6);
    backdrop-filter: blur(12px);
    animation: hintSlide 0.3s ease-out;
  `
  document.body.appendChild(hint)
  setTimeout(() => {
    hint.style.opacity = '0'
    hint.style.transition = 'opacity 0.2s ease'
    setTimeout(() => hint.remove(), 220)
  }, 1200)
}

const keyboardStyles = document.createElement('style')
keyboardStyles.textContent = `
  @keyframes captureFlash {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes hintSlide {
    0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .keyboard-hint__key {
    background: linear-gradient(135deg, #3ddad7, #3c7dff);
    color: #040614;
    padding: 4px 10px;
    border-radius: 6px;
    font-family: "Geist Mono", monospace;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 12px;
  }
`
document.head.appendChild(keyboardStyles)

cameraSelect.addEventListener('change', () => {
  localStorage.setItem('motion_camera', cameraSelect.value)
  void initCamera()
})

captureButtonEl.addEventListener('click', () => { void captureFrame() })

document.getElementById('addText')?.addEventListener('click', () => {
  const text = prompt('Introduce el texto a añadir al frame:')
  if (text && text.trim()) {
    overlayManager.addText(text.trim())
    updateOverlayStatus()
    setExportStatus('Texto preparado para la próxima captura')
  }
})

document.getElementById('clearOverlays')?.addEventListener('click', () => {
  overlayManager.clear()
  updateOverlayStatus()
  setExportStatus('Overlays pendientes eliminados')
})

fpsInputEl.addEventListener('input', (event) => {
  store.updateSettings({ fps: Number((event.target as HTMLInputElement).value) })
  persistSettingsDefaults()
})

document.getElementById('onionToggle')?.addEventListener('click', () => {
  store.updateSettings({ onionEnabled: !store.getState().settings.onionEnabled })
  persistSettingsDefaults()
})

document.getElementById('gridToggle')?.addEventListener('click', () => {
  store.updateSettings({ gridEnabled: !store.getState().settings.gridEnabled })
  persistSettingsDefaults()
})

zoomSliderEl.addEventListener('input', (event) => {
  store.updateSettings({ zoom: Number((event.target as HTMLInputElement).value) })
  persistSettingsDefaults()
})

guideToggleEl.addEventListener('click', () => {
  const current = store.getState().settings.motionGuide
  store.updateSettings({ motionGuide: { ...current, enabled: !current.enabled } })
  persistSettingsDefaults()
  restoreIdleOverlay()
})

guideStartFrameEl.addEventListener('input', (e) => {
  const current = store.getState().settings.motionGuide
  store.updateSettings({ motionGuide: { ...current, startFrame: Number((e.target as HTMLInputElement).value) } })
  persistSettingsDefaults()
  restoreIdleOverlay()
})

guideDurationEl.addEventListener('input', (e) => {
  const current = store.getState().settings.motionGuide
  store.updateSettings({ motionGuide: { ...current, durationFrames: Number((e.target as HTMLInputElement).value) } })
  persistSettingsDefaults()
  restoreIdleOverlay()
})

guideEasingEl.addEventListener('change', (e) => {
  const current = store.getState().settings.motionGuide
  store.updateSettings({ motionGuide: { ...current, easing: (e.target as HTMLSelectElement).value as any } })
  persistSettingsDefaults()
  restoreIdleOverlay()
})

drawingToggleEl.addEventListener('click', () => {
  const isActive = !drawingManager.enabled
  drawingManager.setEnabled(isActive)
  drawingToggleEl.classList.toggle('active', isActive)
  setExportStatus(isActive ? 'Modo dibujo activado. Dibuja sobre la vista previa.' : 'Modo dibujo desactivado')
})

onionOpacityEl.addEventListener('input', (event) => {
  store.updateSettings({ onionOpacity: Number((event.target as HTMLInputElement).value) })
  persistSettingsDefaults()
})

document.getElementById('rotate')?.addEventListener('click', () => {
  const next = !store.getState().settings.invertCapture
  store.updateSettings({ invertCapture: next })
  persistSettingsDefaults()
  setExportStatus(next ? 'La siguiente captura se guardará girada' : 'Giro desactivado')
})

document.getElementById('mirror')?.addEventListener('click', () => {
  const next = !store.getState().settings.mirrorPreview
  store.updateSettings({ mirrorPreview: next })
  persistSettingsDefaults()
  setExportStatus(next ? 'La siguiente captura se guardará espejada' : 'Espejo desactivado')
})

loopToggleEl.addEventListener('click', () => {
  store.updateSettings({ loopPlayback: !store.getState().settings.loopPlayback })
  persistSettingsDefaults()
})

uiModeToggleEl.addEventListener('click', () => {
  const currentMode = store.getState().settings.uiMode
  if (currentMode === 'advanced') {
    applyAulaDefaults()
    setExportStatus('Modo aula activado')
  } else {
    store.updateSettings({ uiMode: 'advanced' })
    persistSettingsDefaults()
    setExportStatus('Modo pro activado')
  }
})

// Floating mode toggle — requiere confirmación para salir de modo aula
document.getElementById('floatingModeToggle')?.addEventListener('click', () => {
  const currentMode = store.getState().settings.uiMode
  if (currentMode === 'beginner') {
    if (!confirm('¿Cambiar a modo pro?\nSi eres alumno/a, pide ayuda al maestro/a.')) return
    store.updateSettings({ uiMode: 'advanced' })
    persistSettingsDefaults()
    setExportStatus('Modo pro activado')
  } else {
    applyAulaDefaults()
    setExportStatus('Modo aula activado')
  }
})

// Botón de guardado para modo aula
document.getElementById('teacherSaveBtn')?.addEventListener('click', async () => {
  const state = store.getState()
  if (!state.frames.length) {
    setExportStatus('No hay fotogramas para guardar', true)
    return
  }
  const btn = document.getElementById('teacherSaveBtn') as HTMLButtonElement
  btn.disabled = true
  setExportStatus('Guardando proyecto...', true)
  try {
    const exporters = await loadExporters()
    await exporters.exportProjectJson(state.frames, state.settings)
    setExportStatus('✅ Proyecto guardado como JSON')
  } catch {
    setExportStatus('Error al guardar el proyecto', true)
  } finally {
    btn.disabled = false
  }
})

// Welcome screen mode selection buttons
document.getElementById('welcomeModeAula')?.addEventListener('click', () => {
  welcomeDismissed = true
  localStorage.setItem('motion_welcome_dismissed', 'true')
  applyAulaDefaults()
  const welcomeEl = document.getElementById('welcomeOverlay')
  if (welcomeEl) welcomeEl.hidden = true
  void initCamera()
})

document.getElementById('welcomeModePro')?.addEventListener('click', () => {
  welcomeDismissed = true
  localStorage.setItem('motion_welcome_dismissed', 'true')
  store.updateSettings({ uiMode: 'advanced' })
  persistSettingsDefaults()
  const welcomeEl = document.getElementById('welcomeOverlay')
  if (welcomeEl) welcomeEl.hidden = true
  void initCamera()
})

// Rotate and mirror buttons for beginner mode
document.getElementById('rotateBeginner')?.addEventListener('click', () => {
  const next = !store.getState().settings.invertCapture
  store.updateSettings({ invertCapture: next })
  persistSettingsDefaults()
  setExportStatus(next ? 'La siguiente captura se guardará girada' : 'Giro desactivado')
})

document.getElementById('mirrorBeginner')?.addEventListener('click', () => {
  const next = !store.getState().settings.mirrorPreview
  store.updateSettings({ mirrorPreview: next })
  persistSettingsDefaults()
  setExportStatus(next ? 'La siguiente captura se guardará espejada' : 'Espejo desactivado')
})

// Auto-capture controls
;['autoCapture3', 'beginnerAutoCapture3'].forEach((id) => {
  document.getElementById(id)?.addEventListener('click', () => startAutoCapture(3))
})
;['autoCapture5', 'beginnerAutoCapture5'].forEach((id) => {
  document.getElementById(id)?.addEventListener('click', () => startAutoCapture(5))
})
;['autoCapture10', 'beginnerAutoCapture10'].forEach((id) => {
  document.getElementById(id)?.addEventListener('click', () => startAutoCapture(10))
})
;['autoCaptureStop', 'beginnerAutoCaptureStop'].forEach((id) => {
  document.getElementById(id)?.addEventListener('click', () => {
  stopAutoCapture()
  setExportStatus('Auto-captura detenida')
})
})

redoButtonEl.addEventListener('click', async () => {
  if (store.getState().settings.uiMode === 'beginner') {
    const frames = store.getState().frames
    if (frames.length > 0) {
      store.removeFrame(frames[frames.length - 1].id)
      setExportStatus('Último fotograma eliminado')
    }
  } else {
    await store.redo()
  }
})

exportResolutionEl.addEventListener('change', () => {
  store.updateSettings({ exportResolution: exportResolutionEl.value as ProjectSettings['exportResolution'] })
  persistSettingsDefaults()
})

document.querySelectorAll<HTMLElement>('.template-btn').forEach((button) => {
  button.addEventListener('click', () => applyTemplate(button.dataset.template || ''))
})

undoButtonEl.addEventListener('click', async () => { await store.undo() })

document.getElementById('reset')?.addEventListener('click', async () => {
  if (!confirm('¿Borrar todo el proyecto actual?')) return
  if (playing) stopPlayback()
  if (autoCaptureActiveInterval) stopAutoCapture()
  await clearProject()
  const currentSettings = store.getState().settings
  store.setProject([], currentSettings, true)
  setExportStatus('Proyecto reiniciado localmente', true)
})

document.getElementById('purge')?.addEventListener('click', async () => {
  if (!confirm('Esta acción borra caché, proyecto y ajustes locales. ¿Continuar?')) return
  if (playing) stopPlayback()
  if (autoCaptureActiveInterval) stopAutoCapture()
  await clearProject()
  localStorage.removeItem('motion_defaults')
  localStorage.removeItem('motion_camera')
  store.resetProject()
  setExportStatus('Caché y datos locales eliminados', true)
})

document.getElementById('importProject')?.addEventListener('click', () => importFileInput.click())

playButtonEl.addEventListener('click', () => {
  if (playing) {
    stopPlayback()
    return
  }
  startPlayback()
})

document.getElementById('exportWebm')?.addEventListener('click', async () => {
  const state = store.getState()
  if (!state.frames.length) {
    setExportStatus('Añade fotogramas antes de exportar', true)
    return
  }

  const button = document.getElementById('exportWebm') as HTMLButtonElement
  button.disabled = true
  setExportStatus('Generando WebM...', true)

  try {
    const exporters = await loadExporters()
    const blob = await exporters.exportWebM({
      frames: state.frames,
      fps: state.settings.fps,
      resolution: state.settings.exportResolution,
      onProgress: (current, total) => setExportStatus(`Generando vídeo ${Math.round((current / total) * 100)}%`, true)
    })
    downloadBlob(blob, `motion-${Date.now()}.webm`)
    setExportStatus('WebM listo')
  } catch (error) {
    console.error(error)
    setExportStatus('No se pudo exportar a WebM', true)
  } finally {
    button.disabled = false
  }
})

document.getElementById('exportZip')?.addEventListener('click', async () => {
  const state = store.getState()
  if (!state.frames.length) {
    setExportStatus('Añade fotogramas antes de exportar', true)
    return
  }

  const button = document.getElementById('exportZip') as HTMLButtonElement
  button.disabled = true
  setExportStatus('Preparando ZIP de secuencia...', true)

  try {
    const exporters = await loadExporters()
    const blob = await exporters.exportFramesZip({
      frames: state.frames,
      resolution: state.settings.exportResolution,
      onProgress: (current, total) => setExportStatus(`Empaquetando ${Math.round((current / total) * 100)}%`, true)
    })
    downloadBlob(blob, `motion-secuencia-${Date.now()}.zip`)
    setExportStatus('ZIP listo')
  } catch (error) {
    console.error(error)
    setExportStatus('No se pudo exportar la secuencia ZIP', true)
  } finally {
    button.disabled = false
  }
})

document.getElementById('exportJson')?.addEventListener('click', async () => {
  const state = store.getState()
  if (!state.frames.length) {
    setExportStatus('No hay fotogramas para exportar', true)
    return
  }
  const exporters = await loadExporters()
  await exporters.exportProjectJson(state.frames, state.settings)
  setExportStatus('Proyecto JSON exportado')
})

document.getElementById('exportNdjson')?.addEventListener('click', async () => {
  const state = store.getState()
  if (!state.frames.length) {
    setExportStatus('No hay fotogramas para exportar', true)
    return
  }
  const exporters = await loadExporters()
  await exporters.exportProjectNdjson(state.frames, state.settings)
  setExportStatus('Proyecto NDJSON exportado')
})

document.getElementById('exportZootrope')?.addEventListener('click', async () => {
  const state = store.getState()
  if (!state.frames.length) {
    setExportStatus('Necesitas fotogramas para el zootropo', true)
    return
  }
  setExportStatus('Generando zootropo en PDF...', true)
  const exporters = await loadExporters()
  const blob = await exporters.exportZootropePdf(state.frames)
  downloadBlob(blob, `zootropo-${Date.now()}.pdf`)
  setExportStatus('Zootropo listo')
})

document.getElementById('exportPhenakistoscope')?.addEventListener('click', async () => {
  const state = store.getState()
  if (!state.frames.length) {
    setExportStatus('Necesitas fotogramas para el fenakistiscopio', true)
    return
  }
  setExportStatus('Generando fenakistiscopio en PDF...', true)
  const exporters = await loadExporters()
  const blob = await exporters.exportPhenakistoscopePdf(state.frames)
  downloadBlob(blob, `fenakistiscopio-${Date.now()}.pdf`)
  setExportStatus('Fenakistiscopio listo')
})

importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files?.[0]
  if (!file) return

  try {
    const exporters = await loadExporters()
    exporters.validateImportFile(file)
    setExportStatus('Importando proyecto...', true)
    const data = file.name.toLowerCase().endsWith('.ndjson')
      ? await exporters.importProjectNdjson(file)
      : await exporters.importProjectJson(file)
    await clearProject()
    store.setProject(data.frames, data.settings, true)
    setExportStatus('Proyecto importado en este dispositivo')
  } catch (error) {
    console.error(error)
    setExportStatus(error instanceof Error ? error.message : 'No se pudo importar el proyecto', true)
    alert(error instanceof Error ? error.message : 'No se pudo importar el archivo.')
  } finally {
    importFileInput.value = ''
  }
})

const pictoModal = document.getElementById('pictoModal') as HTMLElement
document.getElementById('openPictoModal')?.addEventListener('click', () => {
  pictoModal.hidden = false
})
document.getElementById('closePictoModal')?.addEventListener('click', () => {
  pictoModal.hidden = true
})
pictoModal.addEventListener('click', (event) => {
  if (event.target === pictoModal) {
    pictoModal.hidden = true
  }
})

pictoSearch.addEventListener('input', (event) => {
  const term = (event.target as HTMLInputElement).value.toLowerCase()
  renderPictos(term)
  maybeSearchRemote(term)
})

pictoRemoteToggle.addEventListener('change', () => {
  remotePictoItems = []
  pictoStatus.textContent = pictoRemoteToggle.checked
    ? 'Búsqueda remota activada (requiere internet).'
    : 'Catálogo local listo.'
  renderPictos(pictoSearch.value.toLowerCase())
  if (pictoRemoteToggle.checked) {
    maybeSearchRemote(pictoSearch.value.toLowerCase())
  }
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !pictoModal.hidden) {
    pictoModal.hidden = true
  }
})

if (import.meta.env.DEV) {
  console.log('%c📸 Motion EDUmind - Atajos de teclado', 'color: #3ddad7; font-size: 16px; font-weight: bold;')
  console.log('%cP: reproducir o pausar · L: bucle · B: modo guiado · Flechas: mover selección', 'color: #f5fbff;')
}

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
    return
  }

  const key = event.key.toLowerCase()

  switch (key) {
    case ' ':
    case 'enter':
    case 'c':
    case 'f':
      event.preventDefault()
      void captureFrame()
      if (key === 'c' || key === 'f') {
        showKeyboardHint(key.toUpperCase(), 'Fotograma capturado')
      }
      break

    case 'p':
      event.preventDefault()
      if (playing) {
        stopPlayback()
        showKeyboardHint('P', 'Pausado')
      } else {
        startPlayback()
        showKeyboardHint('P', 'Reproduciendo...')
      }
      break

    case 'l':
      event.preventDefault()
      loopToggleEl.click()
      showKeyboardHint('L', store.getState().settings.loopPlayback ? 'Bucle activado' : 'Bucle desactivado')
      break

    case 'b':
      event.preventDefault()
      uiModeToggleEl.click()
      showKeyboardHint('B', store.getState().settings.uiMode === 'beginner' ? 'Modo aula' : 'Modo pro')
      break

    case 'arrowleft':
      event.preventDefault()
      if (playing) stopPlayback()
      store.moveSelection(-1)
      showKeyboardHint('←', 'Fotograma anterior')
      break

    case 'arrowright':
      event.preventDefault()
      if (playing) stopPlayback()
      store.moveSelection(1)
      showKeyboardHint('→', 'Fotograma siguiente')
      break

    case 'd':
      event.preventDefault()
      void store.undo()
      showKeyboardHint('D', 'Deshacer')
      break

    case 'z':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        if (event.shiftKey) {
          void store.redo()
          showKeyboardHint('⌘⇧Z', 'Rehacer')
        } else {
          void store.undo()
          showKeyboardHint('⌘Z', 'Deshacer')
        }
      }
      break

    case 'r':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        void store.redo()
        showKeyboardHint('R', 'Rehacer')
      }
      break

    case 'g':
      event.preventDefault()
      store.updateSettings({ gridEnabled: !store.getState().settings.gridEnabled })
      persistSettingsDefaults()
      showKeyboardHint('G', store.getState().settings.gridEnabled ? 'Rejilla activada' : 'Rejilla desactivada')
      break

    case 'o':
      event.preventDefault()
      store.updateSettings({ onionEnabled: !store.getState().settings.onionEnabled })
      persistSettingsDefaults()
      showKeyboardHint('O', store.getState().settings.onionEnabled ? 'Onion activado' : 'Onion desactivado')
      break

    case 'e':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        ;(document.getElementById('exportWebm') as HTMLButtonElement)?.click()
        showKeyboardHint('E', 'Exportando WebM...')
      }
      break

    case 'm':
      event.preventDefault()
      store.updateSettings({ mirrorPreview: !store.getState().settings.mirrorPreview })
      persistSettingsDefaults()
      showKeyboardHint('M', store.getState().settings.mirrorPreview ? 'Espejo activado' : 'Espejo desactivado')
      break

    case 'arrowup':
      if (event.shiftKey) {
        event.preventDefault()
        const nextFps = Math.min(15, store.getState().settings.fps + 1)
        store.updateSettings({ fps: nextFps })
        persistSettingsDefaults()
        showKeyboardHint('⇧↑', `FPS: ${nextFps}`)
      }
      break

    case 'arrowdown':
      if (event.shiftKey) {
        event.preventDefault()
        const nextFps = Math.max(1, store.getState().settings.fps - 1)
        store.updateSettings({ fps: nextFps })
        persistSettingsDefaults()
        showKeyboardHint('⇧↓', `FPS: ${nextFps}`)
      }
      break

    case 'backspace':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        const selectedFrame = store.getState().selectedFrameId
        if (selectedFrame) {
          store.removeFrame(selectedFrame)
          showKeyboardHint('⌫', 'Fotograma eliminado')
        }
      }
      break
  }
})

store.subscribe(renderState)

initPWA(() => {})
store.init().then(() => {
  renderState(store.getState())
  renderPremiumFeatureGrid()
  updateAutoCaptureControlsState()
  void loadPictos()
  updateOverlayStatus()

  const welcomeEl = document.getElementById('welcomeOverlay')
  if (welcomeDismissed) {
    // Ya eligió modo en sesión anterior → entrar directamente
    if (welcomeEl) welcomeEl.hidden = true
    // Si estaba en modo aula, garantizar que motion guide queda off
    if (store.getState().settings.uiMode === 'beginner') {
      const mg = store.getState().settings.motionGuide
      if (mg.enabled) {
        store.updateSettings({ motionGuide: { ...mg, enabled: false } })
      }
    }
    void initCamera()
  } else {
    // Primera visita → mostrar pantalla de bienvenida
    if (welcomeEl) welcomeEl.hidden = false
  }
})
