/*
 * Copyright (C) 2024-2026 Luis Vilela Acuña <contacto@edumind.es>
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { AccountTier, PremiumFeatureKey } from './types'

export interface PremiumFeature {
  key: PremiumFeatureKey
  name: string
  description: string
  tier: AccountTier
  icon: string
}

export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    key: 'cloudSync',
    name: 'Sincronización en la nube',
    description: 'Guarda y accede a tus proyectos desde cualquier dispositivo.',
    tier: 'premium',
    icon: '☁️'
  },
  {
    key: 'audioTrack',
    name: 'Pista de audio',
    description: 'Añade música o narración a tu animación.',
    tier: 'premium',
    icon: '🎵'
  },
  {
    key: 'chromaKey',
    name: 'Chroma key',
    description: 'Elimina fondos verdes en tiempo real.',
    tier: 'premium',
    icon: '🟩'
  },
  {
    key: 'mp4Export',
    name: 'Exportar MP4',
    description: 'Exporta tu animación en formato MP4 universal.',
    tier: 'premium',
    icon: '🎬'
  },
  {
    key: 'hdExport',
    name: 'Render HD+',
    description: 'Perfiles premium de master, bitrate alto y colas de render avanzadas.',
    tier: 'premium',
    icon: '📺'
  },
  {
    key: 'gallery',
    name: 'Galería compartida',
    description: 'Publica y explora animaciones de otros creadores.',
    tier: 'premium',
    icon: '🖼️'
  },
  {
    key: 'collaboration',
    name: 'Edición colaborativa',
    description: 'Trabaja en un proyecto con otros usuarios en tiempo real.',
    tier: 'premium',
    icon: '👥'
  }
]

export function isPremiumFeature(key: PremiumFeatureKey): boolean {
  return PREMIUM_FEATURES.some((f) => f.key === key && f.tier === 'premium')
}

export function getFeature(key: PremiumFeatureKey): PremiumFeature | undefined {
  return PREMIUM_FEATURES.find((f) => f.key === key)
}

export function checkAccess(featureKey: PremiumFeatureKey, userTier: AccountTier): boolean {
  const feature = getFeature(featureKey)
  if (!feature) return true // Unknown features are allowed
  if (feature.tier === 'free') return true
  return userTier === 'premium'
}

export function getPremiumUpsellMessage(featureKey: PremiumFeatureKey): string {
  const feature = getFeature(featureKey)
  if (!feature) return ''
  return `${feature.icon} ${feature.name} es una función premium. Actualiza tu cuenta para desbloquearla.`
}
