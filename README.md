# Motion

Editor de **stop-motion** para el aula, en el navegador: se capturan fotogramas con la cámara, se ordenan, se ajusta el ritmo y se exporta la animación. PWA, funciona sin conexión.

> Grabar una animación fotograma a fotograma obliga a planificar, a repartir tareas y a repetir sin frustrarse. Ese es el objetivo pedagógico; el vídeo es la excusa.

Este repositorio es una *release saneada* para revisión de código, reutilización educativa y auditoría. Incluye **tanto la aplicación web como el servidor de API** que corre en [motion.edumind.es](https://motion.edumind.es), como exige la AGPL-3.0 en su artículo 13. No incluye secretos de producción, copias de seguridad ni contenido subido por nadie.

## Arrancar en local

Solo la aplicación web, que es lo que hace falta para trabajar en el editor:

```bash
npm install
npm run dev
```

La galería y el guardado en la nube necesitan además el servidor de API:

```bash
cd server
npm install
cp .env.example .env      # y ajusta los valores
node index.js
```

Sin el servidor la aplicación funciona igual: los proyectos se quedan en el navegador.

## Pruebas

```bash
npm test          # 31 pruebas (Vitest)
npm run build     # compila y comprueba tipos; deja la app y guia-alumnado.html en dist/
```

El CI de GitHub (`.github/workflows/ci.yml`) pasa lo mismo en cada PR, arranca el servidor
y audita las dependencias de runtime. No despliega.

## Arquitectura en dos líneas

`src/` es la aplicación web (TypeScript + Vite, empaquetada como PWA). `server/` es una API pequeña en Express con SQLite que guarda los proyectos del alumnado que decide subirlos, y una galería con «me gusta». La autenticación va contra Authentik por OIDC, verificando el token con JWKS.

## Qué datos se tratan y con qué se comunica

- **Por defecto no sale nada del dispositivo.** Fotogramas, proyectos y ajustes viven en el navegador (IndexedDB y localStorage) hasta que alguien decide guardarlos en la nube.
- **Sin analítica.** No hay Matomo, Google Analytics ni ningún contador. La tipografía (Inter) se sirve desde el propio sitio, no desde Google Fonts. Al abrir la app no se hace ninguna petición a otro dominio.
- **Solo a petición del usuario** la app se comunica con: `api.arasaac.org` y `static.arasaac.org` (buscar pictogramas online, envía el término buscado), `auth.edumind.es` (iniciar sesión, Authentik por OIDC) y la API de proyectos (`VITE_API_URL`; guardar en la nube y galería, requiere sesión).
- Si se guarda en la nube, el servidor almacena el proyecto, su nombre, si es público y el identificador de la cuenta (`sub` de OIDC). No guarda nombres ni correos.

Ver [PRIVACIDAD.md](PRIVACIDAD.md).

## Guía para el alumnado

`guia-alumnado.html` es una guía imprimible para 1.º y 3.º de Primaria. Se publica junto a la app (`/guia-alumnado.html`) y se enlaza desde el panel «Guía rápida».

## Cómo modificarlo

- **Textos de la interfaz**: las plantillas HTML y los textos están en `src/main.ts` (barra, sidebar, guía rápida, FAQ, pie). Los estilos, en `src/style.css`.
- **Añadir un pictograma al catálogo local**: pon el PNG en `public/pictos/arasaac/` y añade la entrada en `public/pictos/catalogs/arasaac.json` (`id`, `label`, `emoji` de respaldo, `img`, `keywords`). Anota el id de ARASAAC en `arasaacIds` y en `CREDITS.md`. Otro catálogo (por ejemplo `senas.json`) se registra en `src/main.ts`, función `loadPictos`.
- **Plantillas A4 (zootropo, fenakistiscopio)** y exportaciones: `src/exporters.ts`.
- **Tipografía**: `public/fonts/` y el `@font-face` al principio de `src/style.css`. Si añades otra, incluye su licencia (OFL) y anótala en `CREDITS.md`.
- **Desactivar la nube y el inicio de sesión**: no definas `VITE_API_URL` al compilar (ver `.env.example`); el botón «Iniciar sesión» sigue existiendo pero no hace falta ningún servidor. Para usar tu propio Authentik, cambia `VITE_OIDC_AUTHORITY` y `VITE_OIDC_CLIENT_ID`.
- **Compilar**: `npm run build`; el resultado está en `dist/` y es estático (cualquier servidor web sirve).

## Hecho con IA

Este recurso se ha desarrollado con *vibe coding* con asistencia de IA (Claude Code y ChatGPT). Lo que ha comprobado el autor:

- las 31 pruebas automáticas (`npm test`) y la compilación con chequeo de tipos (`npm run build`), en local y en el CI de GitHub en cada PR;
- que el servidor de API arranca y responde (`/health`, comprobado en el CI);
- la revisión de licencias del material ajeno ([CREDITS.md](CREDITS.md)) y de las dependencias de runtime (`npm audit` en el CI);
- la revisión de los textos que ve el alumnado (guía rápida, FAQ y `guia-alumnado.html`);
- la ejecución en navegador de escritorio y en tableta, que es donde se usa en el aula.

Política de uso de IA de EDUmind: <https://edumind.es/es/legal/ia>.

## Colaborar

Se puede colaborar **sin programar**: contar cómo te ha ido en clase, reportar un fallo, revisar los textos o traducir. Todo el proyecto está en español. Empieza por [CONTRIBUTING.md](CONTRIBUTING.md) y el [código de conducta](CODE_OF_CONDUCT.md).

¿Un fallo de seguridad? No abras un issue público: ver [SECURITY.md](SECURITY.md).

## Alcance de la release

Qué incluye y qué se deja fuera: [OPEN_SOURCE_RELEASE.md](OPEN_SOURCE_RELEASE.md). Cambios por versión: [CHANGELOG.md](CHANGELOG.md). Material ajeno: [CREDITS.md](CREDITS.md).

## Licencia

Licencia doble **AGPL-3.0-or-later** *o* **EUPL-1.2**, a elección de quien la reutilice. Ver [LICENSE](LICENSE) y [NOTICE](NOTICE).

EDUmind® es marca registrada en España (OEPM). El código es libre; la marca y los logotipos no se ceden con él — ver [TRADEMARKS.md](TRADEMARKS.md).

Por **Luis Vilela Acuña** — maestro de Educación Física.
