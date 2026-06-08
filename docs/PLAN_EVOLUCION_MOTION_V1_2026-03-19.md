# Plan de Evolucion Motion V1

Fecha: 2026-03-19
Scope: UX, UI, manejo, exportacion, desarrollo, seguridad, viabilidad, compatibilidad, pedagogia y funcionalidad

## 1. Objetivo

Elevar `motion_v1` desde una PWA funcional de stopmotion a una herramienta mas robusta para aula y uso multiplataforma, con especial foco en:

- mejorar la adaptacion visual en movil, tablet, portatil y escritorio
- convertir la timeline actual en una timeline temporal real
- unificar la experiencia entre captura, reproduccion y exportacion
- reducir deuda tecnica en los modulos mas sensibles

## 2. Estado actual observado

Base revisada:

- UI principal montada de forma imperativa en [src/main.ts](/var/www/motion_v1/src/main.ts)
- timeline actual basada en tarjetas visuales en [src/timeline.ts](/var/www/motion_v1/src/timeline.ts)
- responsive y layout definidos en [src/style.css](/var/www/motion_v1/src/style.css)
- reproduccion y exportacion en [src/main.ts](/var/www/motion_v1/src/main.ts) y [src/exporters.ts](/var/www/motion_v1/src/exporters.ts)
- persistencia local en [src/storage.ts](/var/www/motion_v1/src/storage.ts)
- estado global en [src/state.ts](/var/www/motion_v1/src/state.ts)

Fortalezas:

- arquitectura ligera, clara y offline-first
- store sencillo y mantenible con undo/redo
- buena base educativa: onion skin, overlays, pictogramas, ayuda contextual
- enfoque privacy-first adecuado para entorno escolar

Limitaciones relevantes:

- la timeline actual no representa tiempo real, solo una secuencia de miniaturas
- la reproduccion usa `frame.durationMs`, pero la exportacion WebM usa `settings.fps`, lo que puede generar diferencias entre lo que el usuario ve y lo que exporta
- el layout principal mantiene una grilla fija de tres columnas y no redefine bien el flujo de trabajo en movil y tablet
- `main.ts` concentra demasiado montaje, eventos, modales, teclado, playback y exportacion
- la promesa de exportacion del README es mas amplia que lo que hoy ofrece la interfaz real
- el SSO actual usa token en `localStorage/sessionStorage`, aceptable como prototipo, mejorable desde seguridad

## 3. Propuesta clave: Timeline temporal de dos capas

### Objetivo UX

Mantener la tira visual de frames ya existente, pero anadir encima una regla temporal superior que permita entender la duracion real del clip y donde esta cada frame en el tiempo.

### Solucion propuesta

La timeline pasaria a tener dos capas:

1. Capa superior: regla temporal
- marcas cada `0.5 s` y `1 s`
- etiquetas `0 s`, `0.5 s`, `1 s`, `1.5 s`, `2 s`...
- linea de reproduccion vertical que avanza durante el play

2. Capa inferior: frames
- miniaturas alineadas con su posicion temporal
- ancho proporcional a la duracion efectiva del frame
- highlight del frame activo
- posibilidad futura de scrubbing y seleccion

### Regla temporal

La formula debe ser unica para toda la app:

- `duracionFrameMs = 1000 / fpsGlobal`
- `tiempoInicioFrame = indice * duracionFrameMs`
- `tiempoTotal = numeroFrames * duracionFrameMs`

Ejemplos:

- a `4 FPS`, el frame 4 llega a `1.0 s`
- a `4 FPS`, el frame 6 llega a `1.5 s`
- a `8 FPS`, el frame 8 llega a `1.0 s`

Esto evita ambiguedades y hace que la timeline, la reproduccion y la exportacion hablen el mismo idioma temporal.

### Cambio tecnico recomendado

Crear un modelo derivado de timeline en `src/timeline.ts` o en un nuevo modulo `src/timeline-metrics.ts`:

- `buildTimelineMetrics(frames, settings)`
- `resolveFrameDuration(frame, settings)`
- `buildTimeMarkers(totalDurationMs, zoomLevel)`

Regla recomendada para V1.1:

- usar `fps` global como fuente de verdad para timeline, playback y exportacion
- mantener `frame.durationMs` solo como compatibilidad o futura evolucion a exposicion por frame

### Interacciones recomendadas

- click en frame: seleccion y preview
- drag horizontal en la regla: scrubbing de reproduccion
- play: la aguja superior se mueve con `requestAnimationFrame`
- hover o focus sobre un frame: mostrar `frame 12 · 2.0 s`

## 4. Propuesta por area

### UX

- reorganizar el flujo en tres modos claros: `Capturar`, `Editar`, `Exportar`
- convertir los railes laterales en paneles adaptativos
- dejar siempre visible la accion principal `Capturar`
- hacer sticky la timeline en tablet y movil
- mostrar metricas utiles arriba de la timeline: numero de frames, fps, duracion total
- permitir seleccion explicita de frame actual
- dar feedback claro cuando play/export/import estan en curso

### UI

- sustituir la grilla fija `80px 1fr 140px` por un layout con areas responsive
- desktop: rail izquierdo + stage + rail derecho
- tablet: stage arriba, controles en filas, timeline fija abajo
- movil: stage a pantalla prioritaria, acciones primarias abajo y paneles secundarios colapsables
- aumentar areas tactiles a minimo 44px
- mejorar contraste en texto pequeno y badges
- reducir ruido visual en sidebars con jerarquia mas fuerte
- introducir estados visuales consistentes: activo, seleccionado, reproduciendo, exportando, bloqueado

### Manejo

- anadir seleccion de frame, duplicar, borrar y mover con mas visibilidad
- soportar scrubbing manual por la timeline
- reproducir desde frame seleccionado y no solo desde el inicio
- boton de play con estados `Play`, `Pause`, `Loop`
- incluir `deshacer/rehacer` con historial visible opcional
- mantener accesos rapidos pero anadir una capa de ayuda visual para alumnado

### Exportacion

Prioridad alta:

- unificar tiempos entre preview y export
- anadir selector de resolucion: original, 720p, 1080p
- anadir ZIP de imagenes PNG/JPG por secuencia
- mostrar duracion final estimada antes de exportar

Prioridad media:

- presets `Aula`, `Redes`, `Presentacion`
- exportacion con portada o frame inicial
- opcion de bucle al exportar GIF cuando se implemente

Observacion:

- hoy la interfaz expone WebM/JSON/NDJSON/PDF, no MP4 ni GIF
- si se quiere MP4 en web, estudiar `ffmpeg.wasm` solo como exportacion opcional por coste de peso y CPU

### Desarrollo

- dividir [src/main.ts](/var/www/motion_v1/src/main.ts) en modulos por dominio:
  - `app-shell.ts`
  - `controls.ts`
  - `playback.ts`
  - `timeline.ts`
  - `keyboard.ts`
  - `dialogs.ts`
- centralizar el calculo temporal en una sola utilidad
- desacoplar render de timeline del DOM bruto para hacerlo testeable
- anadir tests unitarios a:
  - calculo temporal
  - import/export
  - store undo/redo
- anadir pruebas E2E minimas para captura, reordenacion, play y export

### Seguridad

- sustituir el token SSO en `localStorage` por cookie segura si el ecosistema lo permite
- validar tamano maximo de archivo al importar JSON/NDJSON
- limitar numero de frames y peso del proyecto para evitar consumo excesivo de memoria
- sanear y validar payloads importados antes de reconstruir blobs
- revisar `Permissions-Policy`, `CSP` y cabeceras del despliegue
- mantener el acceso remoto a ARASAAC desactivado por defecto y con consentimiento explicito

### Viabilidad

Viabilidad tecnica: alta

Razones:

- ya existe una base modular suficiente
- la timeline actual es simple y sustituible sin rehacer toda la app
- el store actual soporta bien un estado extra para frame activo y posicion de reproduccion
- el producto no depende de backend para estas mejoras

Coste relativo:

- responsive y UX base: medio
- timeline temporal: medio
- scrubbing y playhead: medio-alto
- exportaciones nuevas: medio-alto
- hardening de seguridad: medio

### Compatibilidad

- mantener PWA como base principal
- validar muy bien en Chrome Android, Safari iPadOS/iOS, Edge y Firefox desktop
- revisar especialmente:
  - camara
  - MediaRecorder
  - exportacion WebM
  - comportamiento dentro de WebView Capacitor
- anadir safe-area para iPhone/iPad en modo app instalada
- definir degradaciones elegantes cuando una API no exista

### Pedagogia

- crear un `modo principiante` con menos controles visibles
- incorporar microtutoria contextual:
  - "Haz 4 fotos para ver 1 segundo a 4 FPS"
  - "Activa Onion para mover poco a poco"
- mostrar equivalencias visuales entre frames y tiempo
- incluir plantillas de proyecto por actividad:
  - historia corta
  - ciclo de movimiento
  - experimento
  - lengua de signos o pictogramas
- integrar feedback positivo y lenguaje comprensible para alumnado

### Funcionalidad

Must have:

- timeline temporal superior con hitos en segundos
- playhead animado
- frame activo y scrubbing
- responsive real para movil/tablet
- duracion coherente entre preview y export

Should have:

- seleccion de rango
- duplicado multiple
- presets de exportacion
- indicadores de memoria y peso del proyecto

Could have:

- duracion personalizada por frame
- audio guia o claqueta
- plantillas narrativas
- modo docente con proyectos ejemplo

## 5. Roadmap recomendado

### Fase 1. Normalizacion de tiempo y base responsive

Duracion estimada: 3 a 5 dias

- definir una sola fuente de verdad temporal
- recalcular timeline, playback y export sobre esa fuente
- redisenar layout para desktop, tablet y movil
- anadir estado `selectedFrameId` y `playbackPositionMs`

Entrega:

- app consistente en duracion
- base visual preparada para timeline avanzada

### Fase 2. Timeline temporal interactiva

Duracion estimada: 4 a 6 dias

- regla temporal superior
- playhead animado
- highlight del frame actual
- scrubbing
- tooltips de tiempo y numero de frame

Entrega:

- timeline que comunica tiempo real y mejora control de reproduccion

### Fase 3. Exportacion y robustez

Duracion estimada: 3 a 5 dias

- selector de resolucion
- ZIP de secuencia
- mejoras de feedback de progreso
- validaciones de importacion

Entrega:

- exportacion mas util para aula y uso profesional ligero

### Fase 4. Pedagogia y polish multiplataforma

Duracion estimada: 2 a 4 dias

- modo principiante
- ayudas contextuales
- copy educativo
- QA cruzado en movil/tablet/escritorio

Entrega:

- experiencia mas clara para alumnado y docentes

## 6. Prioridades inmediatas

Orden recomendado:

1. corregir la incoherencia entre `fps`, playback y exportacion
2. redisenar layout responsive del workspace
3. implementar timeline temporal superior con playhead
4. anadir scrubbing y seleccion de frame
5. reforzar exportacion y validaciones de importacion

## 7. Propuesta de implementacion tecnica concreta

Archivos candidatos:

- [src/types.ts](/var/www/motion_v1/src/types.ts)
  - anadir `selectedFrameId`
  - anadir `playbackPositionMs`
  - valorar `timelineZoom`

- [src/state.ts](/var/www/motion_v1/src/state.ts)
  - acciones para seleccionar frame
  - acciones para actualizar posicion de reproduccion
  - util para resolver duracion efectiva

- [src/timeline.ts](/var/www/motion_v1/src/timeline.ts)
  - render de regla temporal
  - render de playhead
  - mapeo `frame -> startMs/endMs`
  - scrubbing

- [src/main.ts](/var/www/motion_v1/src/main.ts)
  - desacoplar playback actual
  - usar `requestAnimationFrame` para playhead
  - sincronizar stage y timeline

- [src/style.css](/var/www/motion_v1/src/style.css)
  - reescribir layout responsive
  - anadir estilos de timeline temporal
  - mejorar hit areas y safe-areas

## 8. Riesgos y mitigaciones

- Riesgo: el cambio de timeline rompa drag and drop actual
  - Mitigacion: separar la capa temporal de la capa de tarjetas

- Riesgo: Safari o WebView se comporten distinto en exportacion
  - Mitigacion: matriz de QA por dispositivo y fallback de formatos

- Riesgo: mas estado UI complique `main.ts`
  - Mitigacion: modularizar antes de ampliar comportamiento

- Riesgo: proyectos muy grandes saturen memoria
  - Mitigacion: limites, avisos y exportacion por secuencia

## 9. Conclusión

`motion_v1` ya tiene una base suficientemente buena para evolucionar a una app de stopmotion mucho mas clara, pedagogica y profesional.

La mejora con mayor impacto no es solo "hacer mas bonita la timeline", sino convertirla en un sistema temporal coherente que:

- explique al usuario cuanto dura su animacion
- permita controlar mejor la reproduccion
- haga consistente lo que ve, lo que oye en instrucciones pedagogicas y lo que exporta

La recomendacion es ejecutar primero una fase corta de estabilizacion temporal y responsive, y a continuacion abordar la nueva timeline con playhead y scrubbing.
