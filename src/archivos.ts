// Abrir y guardar archivos: en la app instalada usa los diálogos del sistema;
// en el navegador usa el selector de archivos y la descarga local. Nunca se sube nada.
import { T } from "./i18n";

export const enApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Archivo que no se puede pisar (por ejemplo, el original con firma digital).
let protegido: string | null = null;
export function protegerOriginal(ruta: string | null | undefined) { protegido = ruta || null; }
const igual = (a: string, b: string) => a.replace(/\\/g, "/").toLowerCase() === b.replace(/\\/g, "/").toLowerCase();

// Antes de escribir: avisa si la carpeta se sube a la nube y no deja pisar el original protegido.
// Devuelve true si se puede guardar ahí.
async function puedoGuardar(ruta: string): Promise<boolean> {
  const { ask, message } = await import("@tauri-apps/plugin-dialog");
  if (protegido && igual(ruta, protegido)) {
    await message(T("Ese es el PDF original con firma digital. Guardalo con otro nombre para que el original siga firmado."), { title: "Ozone PDF", kind: "warning" });
    return false;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const nube = await invoke<string | null>("carpeta_nube", { ruta });
    if (nube) {
      return await ask(
        T("Esta carpeta se sincroniza con la nube:") + "\n" + nube + "\n\n" +
        T("El servicio de nube (OneDrive, Google Drive, Dropbox…) va a subir el archivo a internet. Ozone PDF no usa internet, pero ese servicio sí.") +
        "\n\n" + T("¿Querés guardar ahí igual?"),
        { title: "Ozone PDF", kind: "warning", okLabel: T("Guardar igual"), cancelLabel: T("Elegir otra carpeta") },
      );
    }
  } catch { /* si no se puede revisar, se guarda normalmente */ }
  return true;
}

// Pide dónde guardar hasta que la persona elija un lugar que acepta (o cancele).
async function elegirDestino(defaultPath: string, filtro: { name: string; extensions: string[] }): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  for (;;) {
    const ruta = await save({ defaultPath, filters: [filtro] });
    if (!ruta) return null;
    if (await puedoGuardar(ruta)) return ruta;
    defaultPath = ruta;
  }
}

export type Abierto = { nombre: string; datos: ArrayBuffer; ruta?: string; clave?: string };

export async function abrirConDialogo(): Promise<Abierto | null> {
  if (enApp) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const ruta = await open({ multiple: false, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!ruta || Array.isArray(ruta)) return null;
    const bytes = await readFile(ruta);
    return { nombre: nombreDe(ruta), datos: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, ruta };
  }
  return new Promise((resolver) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.onchange = async () => {
      const f = input.files?.[0];
      resolver(f ? { nombre: f.name, datos: await f.arrayBuffer() } : null);
    };
    input.click();
  });
}

export async function desdeArchivo(f: File): Promise<Abierto> {
  return { nombre: f.name, datos: await f.arrayBuffer() };
}

export function nombreDe(ruta: string) {
  if (/^content:/i.test(ruta)) {
    // Android: content://…/document/primary%3ADownload%2Fcontrato.pdf → contrato.pdf
    let ultimo = ruta.split("/").pop() || "";
    try { ultimo = decodeURIComponent(ultimo); } catch { /* queda como está */ }
    ultimo = ultimo.split(/[\\/:]/).pop() || "";
    return /\.pdf$/i.test(ultimo) ? ultimo : "Documento.pdf";
  }
  return ruta.split(/[\\/]/).pop() || "documento.pdf";
}

export function nombreSugerido(nombre: string) {
  const base = nombre.replace(/\.pdf$/i, "");
  return `${base} (Ozone).pdf`;
}

// Devuelve true si se guardó.
export async function guardarConDialogo(datos: Uint8Array, nombre: string, rutaOriginal?: string): Promise<boolean> {
  const sugerido = nombreSugerido(nombre);
  if (enApp) {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    let defaultPath = sugerido;
    if (rutaOriginal) {
      const corte = Math.max(rutaOriginal.lastIndexOf("/"), rutaOriginal.lastIndexOf("\\"));
      if (corte >= 0) defaultPath = rutaOriginal.slice(0, corte + 1) + sugerido;
    }
    const ruta = await elegirDestino(defaultPath, { name: "PDF", extensions: ["pdf"] });
    if (!ruta) return false;
    await writeFile(ruta, datos);
    return true;
  }
  const url = URL.createObjectURL(new Blob([datos as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = sugerido;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

// Con la app ya abierta, otra app (WhatsApp, Gmail, Archivos) le manda un PDF: se avisa para abrirlo.
export async function alLlegarArchivo(f: () => void) {
  if (!enApp) return;
  const { listen } = await import("@tauri-apps/api/event");
  await listen("archivo-abierto", () => f());
}

// Si la app se abrió con "Abrir con… Ozone PDF", carga ese archivo.
export async function archivoInicial(): Promise<Abierto | null> {
  if (!enApp) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const ruta = await invoke<string | null>("archivo_inicial");
  if (!ruta) return null;
  const bytes = await readFile(ruta);
  return { nombre: nombreDe(ruta), datos: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, ruta };
}

// Elegir varios PDF (para unir).
export async function abrirVarios(): Promise<Abierto[]> {
  if (enApp) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const rutas = await open({ multiple: true, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!rutas) return [];
    const lista = Array.isArray(rutas) ? rutas : [rutas];
    const out: Abierto[] = [];
    for (const ruta of lista) {
      const b = await readFile(ruta);
      out.push({ nombre: nombreDe(ruta), ruta, datos: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer });
    }
    return out;
  }
  return new Promise((resolver) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.multiple = true;
    input.onchange = async () => {
      const fs = [...(input.files || [])];
      resolver(await Promise.all(fs.map(desdeArchivo)));
    };
    input.click();
  });
}

const TIPOS: Record<string, { mime: string; nombre: string }> = {
  pdf: { mime: "application/pdf", nombre: "PDF" },
  txt: { mime: "text/plain", nombre: "Texto" },
  png: { mime: "image/png", nombre: "PNG" },
  jpg: { mime: "image/jpeg", nombre: "JPG" },
};

function extension(nombre: string) {
  return (nombre.split(".").pop() || "pdf").toLowerCase();
}

function descargar(datos: Uint8Array, nombre: string) {
  const t = TIPOS[extension(nombre)] || TIPOS.pdf;
  const url = URL.createObjectURL(new Blob([datos as BlobPart], { type: t.mime }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Guarda un archivo con el nombre exacto que se le pasa (eligiendo dónde en la app instalada).
// Devuelve la ruta donde quedó (o el nombre, en el navegador), o false si se canceló.
export async function guardarArchivo(datos: Uint8Array, nombre: string, junto?: string): Promise<string | false> {
  if (enApp) {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const ext = extension(nombre);
    let defaultPath = nombre;
    if (junto) {
      const corte = Math.max(junto.lastIndexOf("/"), junto.lastIndexOf("\\"));
      if (corte >= 0) defaultPath = junto.slice(0, corte + 1) + nombre;
    }
    const ruta = await elegirDestino(defaultPath, { name: (TIPOS[ext] || TIPOS.pdf).nombre, extensions: [ext] });
    if (!ruta) return false;
    await writeFile(ruta, datos);
    return ruta;
  }
  descargar(datos, nombre);
  return nombre;
}

// Guarda varios archivos: en la app se elige una carpeta; en el navegador se descargan uno por uno.
export async function guardarVarios(archivos: { nombre: string; datos: Uint8Array }[]): Promise<boolean> {
  if (enApp) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    let carpeta: string | null = null;
    for (;;) {
      const c = await open({ directory: true, multiple: false });
      if (!c || Array.isArray(c)) return false;
      const sep0 = c.includes("\\") ? "\\" : "/";
      if (await puedoGuardar(c.replace(/[\\/]$/, "") + sep0 + archivos[0].nombre)) { carpeta = c; break; }
    }
    const sep = carpeta.includes("\\") ? "\\" : "/";
    for (const a of archivos) await writeFile(carpeta.replace(/[\\/]$/, "") + sep + a.nombre, a.datos);
    return true;
  }
  for (const a of archivos) {
    descargar(a.datos, a.nombre);
    await new Promise((r) => setTimeout(r, 350));
  }
  return true;
}

export function base(nombre: string) {
  return nombre.replace(/\.pdf$/i, "").replace(/ \(Ozone\)$/, "");
}

// Abre un enlace en el navegador de la persona (la app en sí no se conecta a nada).
export async function abrirEnlace(url: string) {
  if (enApp) {
    try { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(url); } catch { /* sin navegador */ }
  } else window.open(url, "_blank", "noopener");
}

// Elegir fotos o escaneos (JPG, PNG…) para armar un PDF.
export type Imagen = { nombre: string; datos: Uint8Array };
export async function abrirImagenes(): Promise<Imagen[]> {
  if (enApp) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const rutas = await open({ multiple: true, filters: [{ name: T("Imágenes"), extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif", "tif", "tiff"] }] });
    if (!rutas) return [];
    const lista = Array.isArray(rutas) ? rutas : [rutas];
    const out: Imagen[] = [];
    for (const r of lista) out.push({ nombre: nombreDe(r), datos: await readFile(r) });
    return out;
  }
  return new Promise((resolver) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.onchange = async () => resolver(await Promise.all([...(input.files || [])].map(async (f) => ({ nombre: f.name, datos: new Uint8Array(await f.arrayBuffer()) }))));
    input.click();
  });
}

// Documentos de Word (.docx) para convertirlos a PDF.
const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export async function abrirWord(): Promise<Imagen[]> {
  if (enApp) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const rutas = await open({ multiple: true, filters: [{ name: "Word", extensions: ["docx"] }] });
    if (!rutas) return [];
    const lista = Array.isArray(rutas) ? rutas : [rutas];
    const out: Imagen[] = [];
    for (const r of lista) out.push({ nombre: nombreDe(r), datos: await readFile(r) });
    return out;
  }
  return new Promise((resolver) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = `.docx,${TIPO_DOCX}`; input.multiple = true;
    input.onchange = async () => resolver(await Promise.all([...(input.files || [])].map(async (f) => ({ nombre: f.name, datos: new Uint8Array(await f.arrayBuffer()) }))));
    input.click();
  });
}

// "Buscar actualizaciones": la app no se conecta. Si vino de Microsoft Store, la Store la actualiza;
// si no, abre la página de descargas en el navegador con la versión instalada y la página compara.
export async function origenInstalacion(): Promise<"tienda" | "directo" | "navegador" | "play" | "appstore"> {
  if (!enApp) return "navegador";
  try { const { invoke } = await import("@tauri-apps/api/core"); return await invoke<"tienda" | "directo" | "play" | "appstore">("origen_instalacion"); }
  catch { return "directo"; }
}
export function paginaActualizaciones(idioma: string) {
  const carpeta = idioma === "es" ? "" : `${idioma}/`;
  return `https://pachelabs.net/${carpeta}ozone-pdf.html?version=${encodeURIComponent(__VERSION__)}#descargar`;
}
