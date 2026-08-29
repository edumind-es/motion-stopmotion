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
npm test          # 42 pruebas
npm run build     # compila y comprueba tipos
```

## Arquitectura en dos líneas

`src/` es la aplicación web (TypeScript + Vite, empaquetada como PWA). `server/` es una API pequeña en Express con SQLite que guarda los proyectos del alumnado que decide subirlos, y una galería con «me gusta». La autenticación va contra Authentik por OIDC, verificando el token con JWKS.

## Qué datos se tratan

- **Por defecto no sale nada del dispositivo.** Los proyectos viven en el navegador hasta que alguien decide guardarlos en la nube.
- Si se guardan, el servidor almacena el proyecto, su nombre, si es público y el identificador de la cuenta (`sub` de OIDC). No guarda nombres ni correos.
- La web carga **Matomo autoalojado, sin cookies y respetando «No rastrear»**, solo para contar visitas. No hay perfilado ni terceros.

Ver [PRIVACIDAD.md](PRIVACIDAD.md).

## Colaborar

Se puede colaborar **sin programar**: contar cómo te ha ido en clase, reportar un fallo, revisar los textos o traducir. Todo el proyecto está en español. Empieza por [CONTRIBUTING.md](CONTRIBUTING.md) y el [código de conducta](CODE_OF_CONDUCT.md).

¿Un fallo de seguridad? No abras un issue público: ver [SECURITY.md](SECURITY.md).

## Alcance de la release

Qué incluye y qué se deja fuera: [OPEN_SOURCE_RELEASE.md](OPEN_SOURCE_RELEASE.md).

## Licencia

Licencia doble **AGPL-3.0-or-later** *o* **EUPL-1.2**, a elección de quien la reutilice. Ver [LICENSE](LICENSE) y [NOTICE](NOTICE).

EDUmind® es marca registrada en España (OEPM). El código es libre; la marca y los logotipos no se ceden con él — ver [TRADEMARKS.md](TRADEMARKS.md).

Por **Luis Vilela Acuña** — maestro de Educación Física.
