# Privacidad y protección de datos — Motion

Este documento describe qué trata la aplicación tal y como está publicada aquí, y qué trata la instancia que EDUmind opera en [motion.edumind.es](https://motion.edumind.es). Está escrito para tres lectores: el docente que la usa, el responsable de protección de datos de un centro, y quien quiera auditar el código.

No es asesoramiento jurídico. Todo lo que se afirma aquí se puede comprobar en el código, que está bajo AGPL-3.0-or-later o EUPL-1.2.

## 1. El principio de diseño

**Por defecto no sale nada del dispositivo.** Se puede grabar una animación entera, exportarla y usarla en clase sin que ningún dato llegue a ningún servidor. Subir un proyecto es una acción deliberada.

## 2. Qué datos se tratan

### 2.1 Mientras se trabaja: solo en el navegador

Los fotogramas, el proyecto y los ajustes viven en el almacenamiento del navegador. No se envían a ninguna parte. En concreto:

| Dónde | Qué | Cuánto tiempo |
|---|---|---|
| IndexedDB `motion` (`src/storage.ts`) | fotogramas (imágenes de cámara o pictogramas), proyectos, pista de audio, metadatos | hasta que el usuario borra el proyecto, pulsa «Limpiar caché» o borra los datos del sitio en el navegador |
| localStorage | ajustes (`motion_defaults`), cámara elegida (`motion_camera`), objetivo de fotos (`motion_frame_target`), bienvenida vista (`motion_welcome_dismissed`), aviso de grabación aceptado (`motion_media_consent_v1`), nivel de cuenta (`edumind_tier`) | igual |
| sessionStorage | tokens y perfil OIDC (`name`, `preferred_username`, `email`) **solo tras iniciar sesión** | hasta cerrar la pestaña |

**La cámara se usa en local.** El vídeo no se transmite: se capturan fotogramas y se quedan en el dispositivo.

Las exportaciones (WebM, ZIP, JSON/NDJSON, PDF) se descargan al dispositivo y no llevan nombres de personas.

### 2.2 Si se guarda en la nube

Al guardar un proyecto, el servidor almacena:

| Dato | Para qué |
|---|---|
| Identificador de cuenta (`sub` de OIDC) | saber de quién es el proyecto |
| Nombre del proyecto | listarlo |
| Contenido del proyecto y número de fotogramas | poder recuperarlo |
| Si es público | mostrarlo o no en la galería |
| Fechas de creación y de última modificación | ordenar la lista |

El esquema completo está en [`server/db.js`](server/db.js): dos tablas, `projects` y `gallery_likes`.

**No se guarda nombre, apellidos, correo ni centro.** El servidor solo conoce el identificador opaco que emite Authentik.

**Cuánto tiempo:** hasta que el propietario borra el proyecto desde la app (el borrado es real, `DELETE` en la base de datos, [`server/index.js`](server/index.js)). No hay purga automática. Ten en cuenta que los fotogramas son fotos de cámara y pueden contener caras: un proyecto marcado como público se sirve sin autenticación en la galería; no lo marques así si aparecen personas sin su permiso.

### 2.3 La galería

Un proyecto solo aparece en la galería si alguien lo marca como público, y se puede volver a privado en cualquier momento. Los «me gusta» guardan qué cuenta ha dado el «me gusta» a qué proyecto, para no contarlos dos veces.

## 3. Analítica y cargas de terceros

**No hay analítica**: ni Matomo, ni Google Analytics, ni píxeles, ni contadores de ningún tipo (retirado en la versión 3.0.1). La tipografía Inter se sirve desde el propio sitio (`public/fonts/inter`), no desde Google Fonts. Al abrir la app, el navegador solo habla con el dominio que la sirve.

La app se comunica con otros dominios **únicamente cuando el usuario lo pide**:

| Dominio | Cuándo | Qué se envía |
|---|---|---|
| `api.arasaac.org`, `static.arasaac.org` | al marcar «Buscar en ARASAAC online» en el selector de pictogramas | el término buscado; la petición lleva, como toda petición HTTP, la IP y el user-agent |
| `auth.edumind.es` (Authentik) | al pulsar «Iniciar sesión» | flujo OIDC; Motion nunca ve la contraseña |
| API de proyectos (`VITE_API_URL`, en la instancia de EDUmind `motion.edumind.es/motion-api`) | al guardar en la nube, abrir la galería o dar «me gusta», con sesión iniciada | lo descrito en 2.2 |

## 4. Autenticación

Se delega en **Authentik**, por OIDC. Motion nunca ve la contraseña: recibe un token y lo verifica contra el JWKS del proveedor ([`server/auth.js`](server/auth.js)).

## 5. Quién es responsable de qué

- **De la instancia de EDUmind** responde EDUmind® — Luis Vilela Acuña.
- **Si despliegas tu propia instancia**, el responsable del tratamiento eres tú o tu centro. Revisa la sección 7 antes.

## 6. Ejercicio de derechos

Sobre la instancia de EDUmind, escribe a **contacto@edumind.es**. Un proyecto se puede borrar desde la propia aplicación, y el borrado es efectivo en la base de datos, no un marcado.

## 7. Si despliegas tu propia instancia

1. Configura tu propio proveedor OIDC en `server/.env` y en `.env.local` (variables `VITE_OIDC_*`); los valores de ejemplo apuntan al de EDUmind. Si no quieres nube ni galería, no definas `VITE_API_URL`.
2. Si añades analítica, documéntala aquí: esta app se distribuye sin ninguna.
3. Restringe `CORS_ORIGINS` a tu dominio.
4. Pon la base de datos SQLite fuera del directorio servido por el servidor web y con copia de seguridad.
5. Sirve todo por HTTPS: la cámara y el service worker no funcionan por HTTP salvo en `localhost`.

## Contacto

EDUmind® — Luis Vilela Acuña · <contacto@edumind.es>

Si detectas un fallo que exponga datos personales, no abras un issue público: ver [SECURITY.md](SECURITY.md).
