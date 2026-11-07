# Ozone PDF 2

Editor de PDF **gratis y sin conexión** de [Pache Labs](https://pachelabs.net).
Firmá, anotá y censurá tus PDF sin subirlos a ningún lado.

> Esta es la nueva versión multiplataforma (Windows, macOS, Linux y, más adelante, Android e iOS).
> La versión 1 (Python) sigue en [Pache_PDF](https://github.com/pachelabs-apps/Pache_PDF) y en la Microsoft Store.

## Qué hace (fase 1)

- **Visor** con miniaturas, zoom y ajuste al ancho.
- **Resaltar, subrayar y tachar** texto arrastrando por encima.
- **Texto, recuadros y dibujo a mano alzada**, en cinco colores.
- **Firmar**: dibujás tu firma con el mouse o el dedo (o subís una imagen) y la ponés donde quieras. Se puede mover y agrandar.
- **Censurar de verdad**: lo que marcás se **borra del archivo** al guardar (texto, imágenes y dibujos), no solo se tapa.
- Deshacer, borrar y mover anotaciones; atajos de teclado (Ctrl+O, Ctrl+S, Ctrl+Z, Supr).
- Abre PDF con contraseña. Se puede usar con "Abrir con… Ozone PDF".
- En seis idiomas: español, inglés, alemán, chino, japonés y ruso.
- Pantalla adaptada a celular (las herramientas pasan abajo).

## Privacidad

- Todo el trabajo lo hace **MuPDF** dentro de la app, en tu equipo.
- La app tiene una regla de seguridad (CSP) que **no le permite conectarse a ningún servidor**.
- La firma se guarda solo en tu equipo, si tildás "Recordar en este equipo".

## Tecnología

| Parte | Qué se usa |
|---|---|
| Pantalla | React + TypeScript (Vite) |
| Motor PDF | [MuPDF.js](https://mupdf.com) (WebAssembly), en un Worker aparte |
| App de escritorio | [Tauri 2](https://tauri.app) (Rust) — instaladores de ~6 MB |

## Probar en la compu

Necesitás [Node.js 22](https://nodejs.org) y [Rust](https://rustup.rs).
En Windows, además, las "Herramientas de compilación de C++" de Visual Studio (Tauri lo explica en su guía de requisitos).

```bash
npm install
npm run tauri dev      # abre la app en modo desarrollo
npm run tauri build    # genera el instalador en src-tauri/target/release/bundle
```

Para ver solo la pantalla en el navegador: `npm run dev` y abrir http://localhost:1420.

## Instaladores automáticos

Al subir una etiqueta de versión, GitHub genera los instaladores de **Windows (.msi y .exe), macOS (.dmg universal) y Linux (.deb y .AppImage)** y los deja en un release en borrador:

```bash
git tag v2.0.0
git push origin v2.0.0
```

En macOS, como la app no está firmada con una cuenta de Apple, la primera vez hay que abrirla desde
Ajustes del Sistema → Privacidad y seguridad → "Abrir igualmente".

## Licencia

AGPL-3.0-or-later, igual que MuPDF. © 2026 Nicolás Pacheco (Pache Labs).
Los nombres "Pache Labs", "Ozone PDF" y el personaje Labcin no están incluidos en la licencia del código.
