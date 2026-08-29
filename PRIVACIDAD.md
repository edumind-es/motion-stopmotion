# Privacidad y protección de datos — Motion

Este documento describe qué trata la aplicación tal y como está publicada aquí, y qué trata la instancia que EDUmind opera en [motion.edumind.es](https://motion.edumind.es). Está escrito para tres lectores: el docente que la usa, el responsable de protección de datos de un centro, y quien quiera auditar el código.

No es asesoramiento jurídico. Todo lo que se afirma aquí se puede comprobar en el código, que está bajo AGPL-3.0-or-later o EUPL-1.2.

## 1. El principio de diseño

**Por defecto no sale nada del dispositivo.** Se puede grabar una animación entera, exportarla y usarla en clase sin que ningún dato llegue a ningún servidor. Subir un proyecto es una acción deliberada.

## 2. Qué datos se tratan

### 2.1 Mientras se trabaja: solo en el navegador

Los fotogramas, el proyecto y los ajustes viven en el almacenamiento del navegador. No se envían a ninguna parte.

**La cámara se usa en local.** El vídeo no se transmite: se capturan fotogramas y se quedan en el dispositivo.

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

### 2.3 La galería

Un proyecto solo aparece en la galería si alguien lo marca como público, y se puede volver a privado en cualquier momento. Los «me gusta» guardan qué cuenta ha dado el «me gusta» a qué proyecto, para no contarlos dos veces.

## 3. Analítica

La web carga **Matomo autoalojado** en los servidores de EDUmind, configurado así:

- **sin cookies** (`disableCookies`)
- respetando la señal **«No rastrear»** del navegador (`setDoNotTrack`)
- solo cuenta visitas de página y clics en enlaces

No hay Google Analytics, ni píxeles, ni terceros. Los datos no salen de la infraestructura de EDUmind. Si despliegas tu propia instancia, quita el bloque de Matomo de `index.html`: apunta al Matomo de EDUmind, no al tuyo.

## 4. Autenticación

Se delega en **Authentik**, por OIDC. Motion nunca ve la contraseña: recibe un token y lo verifica contra el JWKS del proveedor ([`server/auth.js`](server/auth.js)).

## 5. Quién es responsable de qué

- **De la instancia de EDUmind** responde EDUmind® — Luis Vilela Acuña.
- **Si despliegas tu propia instancia**, el responsable del tratamiento eres tú o tu centro. Revisa la sección 7 antes.

## 6. Ejercicio de derechos

Sobre la instancia de EDUmind, escribe a **contacto@edumind.es**. Un proyecto se puede borrar desde la propia aplicación, y el borrado es efectivo en la base de datos, no un marcado.

## 7. Si despliegas tu propia instancia

1. Quita el bloque de Matomo de `index.html`, o cámbialo por el tuyo.
2. Configura tu propio proveedor OIDC en `server/.env`; los valores de ejemplo apuntan al de EDUmind.
3. Restringe `CORS_ORIGINS` a tu dominio.
4. Pon la base de datos SQLite fuera del directorio servido por el servidor web y con copia de seguridad.
5. Sirve todo por HTTPS: la cámara y el service worker no funcionan por HTTP salvo en `localhost`.

## Contacto

EDUmind® — Luis Vilela Acuña · <contacto@edumind.es>

Si detectas un fallo que exponga datos personales, no abras un issue público: ver [SECURITY.md](SECURITY.md).
