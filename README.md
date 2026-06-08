# 🎬 Motion - Editor de Stopmotion Educativo

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-green)](https://web.dev/progressive-web-apps/)

**Motion** es un editor de stopmotion educativo diseñado para crear animaciones stop-motion de forma sencilla directamente en el navegador. Perfecto para el aula, sin necesidad de instalación.

🌐 **Demo en vivo:** [motion.edumind.es](https://motion.edumind.es)

---

## ✨ Características

- 📸 **Captura desde webcam** - Usa la cámara de tu dispositivo
- 🎞️ **Timeline visual** - Línea de tiempo intuitiva para gestionar frames
- ⏪ **Onion skin** - Transparencia de frames anteriores para mejor alineación
- 🎨 **Sistema de capas** - Organiza tus elementos
- 🎭 **Pictogramas ARASAAC** - Biblioteca integrada de pictogramas educativos
- 📱 **PWA** - Instálala como app en cualquier dispositivo
- 💾 **Exportación** - Exporta a video MP4, GIF o ZIP de imágenes
- ⚡ **Sin servidor** - Todo funciona en el cliente, datos 100% privados
- 🌍 **Multiidioma** - Español, inglés, gallego, catalán, euskera, chino

---

## 🚀 Inicio Rápido

### Uso Online (Recomendado)

Simplemente abre [motion.edumind.es](https://motion.edumind.es) en tu navegador. ¡No necesitas instalar nada!

### Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/edumind-es/motion-stopmotion.git
cd motion-stopmotion

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Construir para producción
npm run build
```

---

## 📖 Uso

1. **Permitir acceso a la cámara** cuando el navegador lo solicite
2. **Captura frames** clickeando en el botón de cámara o presionando `Space`
3. **Organiza tu timeline** arrastrando frames
4. **Reproduce tu animación** con los controles de reproducción
5. **Exporta** tu creación en el formato que prefieras

### ⌨️ Atajos de Teclado

- `Space` - Capturar nuevo frame
- `P` - Play/Pause
- `Delete` - Borrar frame seleccionado
- `←` `→` - Navegar entre frames
- `O` - Toggle onion skin
- `G` - Toggle grid

---

## 🛠️ Tecnologías

- **TypeScript** - Tipado fuerte para mejor mantenibilidad
- **Vite** - Build tool ultra-rápido
- **Web APIs**:
  - MediaDevices API (cámara)
  - Canvas API (renderizado)
  - IndexedDB (almacenamiento local)
  - Service Workers (PWA)

---

## 🎯 Casos de Uso Educativos

- **Educación Primaria:** Crear historias animadas
- **Educación Física:** Análisis del movimiento
- **Artes:** Expresión creativa
- **Ciencias:** Experimentos en time-lapse
- **Idiomas:** Contar historias

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Si quieres mejorar Motion:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: amazing feature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para más detalles.

---

## 📜 Licencia

Este proyecto está bajo licencia **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Esto significa que:
- ✅ Puedes usar el código libremente
- ✅ Puedes modificarlo según tus necesidades
- ✅ Puedes distribuirlo
- ⚠️ Debes mantener la misma licencia
- ⚠️ Debes compartir el código fuente de modificaciones

Ver [LICENSE](LICENSE) para el texto completo de la licencia.

---

## 👨‍💻 Autor

**Luis Vilela Acuña**
- Maestro de Educación Física
- Especialista en bienestar digital
- Creator del ecosistema EDUmind

---

## 🌟 Proyecto EDUmind

Motion es parte del **ecosistema EDUmind**: herramientas digitales libres y abiertas para la educación.

- 🌐 Web: [edumind.es](https://edumind.es)
- 📧 Email: contacto@edumind.es
- 💬 Discord: [Únete a la comunidad](https://discord.gg/YaHXTwbh)
- 📰 Newsletter: [Substack](https://losmundosedufis.substack.com)

**Otros proyectos EDUmind:**
- [Pasos (Breath)](https://pasos.edumind.es) - Respiración consciente
- [GeoBreath](https://breath.edumind.es) - Respiración con mapas
- [Liga EDUmind](https://liga.edumind.es) - Ligas deportivas educativas

---

## 🙏 Agradecimientos

- **ARASAAC** - Por los pictogramas educativos
- **Comunidad EDUmind** - Por el feedback y pruebas
- **Docentes y alumnado** - Por usar y mejorar la herramienta

---

## 📊 Estado del Proyecto

🟢 **Activo** - En desarrollo y mantenimiento constante

- ✅ Versión estable en producción
- 🔄 Mejoras continuas
- 🐛 Bugs corregidos regularmente
- 💡 Nuevas features en desarrollo

---

**¿Preguntas? ¿Ideas?** Abre un [issue](https://github.com/edumind-es/motion-stopmotion/issues) o contáctanos en contacto@edumind.es
