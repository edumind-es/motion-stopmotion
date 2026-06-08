/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
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

import type { PictoCatalog, PictoItem } from './types'

const catalogFiles = ['arasaac.json', 'senas.json']
const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

export async function loadPictoCatalogs(): Promise<PictoCatalog[]> {
  const catalogs: PictoCatalog[] = []
  for (const file of catalogFiles) {
    try {
      const res = await fetch(`${basePath}/pictos/catalogs/${file}`)
      if (!res.ok) continue
      const data = (await res.json()) as PictoCatalog
      catalogs.push(data)
    } catch (error) {
      console.warn('No se pudo cargar catálogo', file, error)
    }
  }
  return catalogs
}

export async function createPictoFrame(item: PictoItem, opts?: { width?: number; height?: number; accent?: string }) {
  const width = opts?.width ?? 1280
  const height = opts?.height ?? 720
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const accent = opts?.accent ?? '#3dd9c4'

  // Fondo
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#0f1d35')
  gradient.addColorStop(1, '#0c2c42')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  const pad = width * 0.05
  roundedRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 28)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (item.img) {
    try {
      const img = await loadImage(item.img)
      const targetSide = Math.min(width, height) * 0.7
      const dx = (width - targetSide) / 2
      const dy = (height - targetSide) / 2
      ctx.drawImage(img, dx, dy, targetSide, targetSide)
    } catch (error) {
      console.warn('No se pudo cargar la imagen remota del pictograma, se usará emoji.', error)
      drawEmoji(ctx, item.emoji || '🧩', width, height)
    }
  } else {
    drawEmoji(ctx, item.emoji || '🧩', width, height)
  }

  ctx.shadowBlur = 0
  ctx.fillStyle = accent
  ctx.font = `${Math.round(height * 0.06)}px 'Space Grotesk', 'Work Sans', sans-serif`
  ctx.fillText(item.label, width / 2, height * 0.82)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('No se pudo renderizar el pictograma'))
      resolve(blob)
    }, 'image/png', 0.92)
  })
}

export function flattenPictoItems(catalogs: PictoCatalog[]): PictoItem[] {
  return catalogs
    .flatMap((catalog) => catalog.categories.map((cat) => ({ catalog: catalog.name, items: cat.items })))
    .flatMap((item) => item.items.map((p) => ({ ...p, catalog: item.catalog })))
}

export async function searchArasaac(term: string, max = 40): Promise<PictoItem[]> {
  if (!term || term.length < 2) return []
  const lang = 'es'
  const url = `https://api.arasaac.org/api/pictograms/${lang}/search/${encodeURIComponent(term)}`
  const resp = await fetch(url)
  if (!resp.ok) return []
  const arr = await resp.json()
  if (!Array.isArray(arr)) return []
  return arr.slice(0, max).map((item: any) => {
    const pid = item?._id ?? item?.id ?? item?.pictogram ?? item
    const base = pid ? `https://static.arasaac.org/pictograms/${pid}/${pid}` : ''
    const keywords = Array.isArray(item?.keywords) ? item.keywords : []
    const label =
      keywords
        .map((k: any) => (typeof k === 'string' ? k : k?.keyword || k?.keywordId || ''))
        .filter(Boolean)[0] || term
    return {
      id: String(pid || `ar-${Math.random().toString(36).slice(2, 9)}`),
      label,
      img: base ? `${base}_500.png` : undefined,
      emoji: '🖼️',
      keywords,
      catalog: 'ARASAAC remoto'
    } as PictoItem
  })
}

function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, width: number, height: number) {
  ctx.font = `${Math.round(height * 0.35)}px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif`
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 18
  ctx.fillText(emoji, width / 2, height / 2)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
