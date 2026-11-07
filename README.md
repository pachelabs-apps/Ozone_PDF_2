# Ozone PDF 2

Editor de PDF **gratis y sin conexión** de [Pache Labs](https://pachelabs.net).
Firmá, anotá y censurá tus PDF sin subirlos a ningún lado.

> Esta es la nueva versión multiplataforma (Windows, macOS, Linux y, más adelante, Android e iOS).
> La versión 1 (Python) sigue en [Pache_PDF](https://github.com/pachelabs-apps/Pache_PDF) y en la Microsoft Store.

## Qué hace

Todo en una sola app, sin programas aparte:

- **Editor:** visor con miniaturas y zoom; resaltar, subrayar y tachar; texto, recuadros y dibujo a mano; **firmar**; **censurar de verdad** (borra lo que está debajo al guardar).
- **Páginas:** rotar, borrar y ordenar arrastrando las miniaturas; **ajustar todas a A4 o Carta** con márgenes.
- **Escáner:** fotos con la cámara o de la galería, con detección de la hoja, enderezado y filtros (original, mejorado, grises, blanco y negro).
- **Herramientas:** unir, dividir (por página, rangos o tamaño), extraer páginas, comprimir, poner y quitar contraseña (AES-256), marca de agua, numerar páginas, PDF a imágenes, PDF a texto y limpiar datos ocultos.
- **Fácil de usar:** inicio con "¿Qué querés hacer?", buscador de herramientas (Ctrl+K), deshacer también para páginas y herramientas, y **Labcin**, el asistente que da tips y sugerencias según el PDF (por ejemplo, ofrece achicarlo si pesa mucho).
- **Accesibilidad:** texto más grande, alto contraste, menos movimiento, texto más espaciado y Labcin que lee en voz alta (Alt+A).
- Seis idiomas: español, inglés, alemán, chino, japonés y ruso. Modo oscuro. Pantalla adaptada a celular.

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

AGPL-3.0-or-later, igual que MuPDF. Todas las bibliotecas y tipografías que usa son libres: ver [LICENCIAS_DE_TERCEROS.md](LICENCIAS_DE_TERCEROS.md). © 2026 Nicolás Pacheco (Pache Labs).
Los nombres "Pache Labs", "Ozone PDF" y el personaje Labcin no están incluidos en la licencia del código.
