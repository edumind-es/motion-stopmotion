# Registro de cambios

Formato libre, una entrada por versión publicada. Las versiones anteriores a la 3.0.1 no
tenían etiqueta; su historia está en los mensajes de commit.

## 3.0.1 — 2026-09-26

Corrección tras la evaluación VCER del 2026-09-25 (rúbrica de recursos educativos).

### Privacidad
- Retirada la analítica (Matomo) por completo: la app no lleva ningún contador.
- Inter se sirve en local (`public/fonts/inter`, OFL 1.1) en vez de desde Google Fonts.
  Al abrir la app no sale ninguna petición a otro dominio.
- Retirados los dos `.woff2` de Geist, que eran páginas HTML 404 guardadas como fuente.

### Contenido
- `guia-alumnado.html`: «cuanto más rápido muevas el objeto → más fluida» corregido a
  «cuanto menos muevas el objeto entre foto y foto → más fluida».
- Los pictogramas locales `feliz`, `camara`, `comer` y `jugar` eran páginas 404 guardadas
  como PNG, y `escuela.png` era el pictograma de «pregunta»: sustituidos por los
  pictogramas ARASAAC reales.
- La guía del alumnado se publica junto a la app y se enlaza desde «Guía rápida».

### Funcionamiento
- Retirado el panel «Expansiones premium», que anunciaba chroma key, MP4, render HD+ y
  edición colaborativa sin que existieran. La exportación a 1080p deja de estar bloqueada
  por nivel de cuenta. Nube y galería siguen igual.

### Accesibilidad
- Contraste de los botones «Proyectos» e «Iniciar sesión» de la barra.
- Etiquetas visibles para la cámara, la opacidad del onion skin, los FPS y el zoom.
- La tira de fotogramas recibe foco de teclado.

### Documentación y créditos
- `CREDITS.md` con ARASAAC, Inter y librerías; atribución visible en el pie.
- `PRIVACIDAD.md`, README, guía rápida y FAQ dicen exactamente qué se guarda dónde y con
  qué dominios se comunica la app y cuándo.
- README: secciones «Cómo modificarlo» y «Hecho con IA»; `.env.example` en la raíz.
- `COPYRIGHT` y `AUTHORS` coherentes con la doble licencia AGPL-3.0-or-later / EUPL-1.2.
- Fuera `public/vite.svg`.
