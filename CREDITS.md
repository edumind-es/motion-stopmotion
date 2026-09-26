# Créditos y material ajeno

Todo lo que Motion usa y no es obra de Luis Vilela Acuña, con su origen y licencia. Si
encuentras algo que falte, abre un issue.

## Pictogramas

Los cinco pictogramas del catálogo local (`public/pictos/arasaac/`) y los que se obtienen al
marcar «Buscar en ARASAAC online»:

> Autor pictogramas: Sergio Palao. Origen: ARASAAC (http://www.arasaac.org). Licencia:
> CC BY-NC-SA. Propiedad: Gobierno de Aragón (España)

| Fichero | Etiqueta en la app | ID ARASAAC |
|---|---|---|
| `feliz.png` | feliz | 9907 |
| `camara.png` | cámara | 24925 |
| `comer.png` | comer | 6456 |
| `jugar.png` | jugar | 23392 |
| `escuela.png` | colegio | 32446 |

La licencia CC BY-NC-SA 4.0 obliga a mantener esta atribución también en los vídeos y
fichas que se exporten con pictogramas. La app la muestra en el pie; si reutilizas los
fotogramas fuera de la app, añádela tú.

## Tipografías

| Tipografía | Autor | Origen | Licencia |
|---|---|---|---|
| Inter (variable) | Rasmus Andersson y The Inter Project Authors | https://github.com/rsms/inter (v4.1) | SIL Open Font License 1.1 — [`public/fonts/inter/OFL.txt`](public/fonts/inter/OFL.txt) |

Se sirve desde el propio sitio; no se pide nada a Google Fonts.

## Iconos e ilustraciones

`public/icons/*` (icono de la PWA, logotipo de Motion, logotipo del pie) son obra propia de
Luis Vilela Acuña. Los emojis de la interfaz los dibuja la tipografía del sistema. La
marca EDUmind® no se cede con el código: ver [TRADEMARKS.md](TRADEMARKS.md).

## Librerías principales

| Librería | Para qué | Licencia |
|---|---|---|
| Vite y vite-plugin-pwa | compilación y service worker | MIT |
| TypeScript | tipos | Apache-2.0 |
| idb | IndexedDB con promesas | ISC |
| jszip | exportar ZIP | MIT o GPL-3.0-or-later (dual) |
| pdf-lib | exportar PDF y plantillas A4 | MIT |
| workbox-window | actualización de la PWA | MIT |
| oidc-client-ts | inicio de sesión OIDC opcional | Apache-2.0 |
| Capacitor (core, camera, android, ios) | empaquetado móvil, no usado en la web | MIT |
| Express, cors, better-sqlite3, jose (servidor) | API opcional de proyectos y galería | MIT |
| dotenv (servidor) | leer `.env` | BSD-2-Clause |
| Vitest y happy-dom | pruebas | MIT |

Las versiones exactas están en `package.json` y `server/package.json`.
