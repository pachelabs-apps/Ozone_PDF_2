// Abrir y guardar archivos: en la app instalada usa los diálogos del sistema;
// en el navegador usa el selector de archivos y la descarga local. Nunca se sube nada.
export const enApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type Abierto = { nombre: string; datos: ArrayBuffer; ruta?: string };

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
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    let defaultPath = sugerido;
    if (rutaOriginal) {
      const corte = Math.max(rutaOriginal.lastIndexOf("/"), rutaOriginal.lastIndexOf("\\"));
      if (corte >= 0) defaultPath = rutaOriginal.slice(0, corte + 1) + sugerido;
    }
    const ruta = await save({ defaultPath, filters: [{ name: "PDF", extensions: ["pdf"] }] });
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
export async function guardarArchivo(datos: Uint8Array, nombre: string, junto?: string): Promise<boolean> {
  if (enApp) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const ext = extension(nombre);
    let defaultPath = nombre;
    if (junto) {
      const corte = Math.max(junto.lastIndexOf("/"), junto.lastIndexOf("\\"));
      if (corte >= 0) defaultPath = junto.slice(0, corte + 1) + nombre;
    }
    const ruta = await save({ defaultPath, filters: [{ name: (TIPOS[ext] || TIPOS.pdf).nombre, extensions: [ext] }] });
    if (!ruta) return false;
    await writeFile(ruta, datos);
    return true;
  }
  descargar(datos, nombre);
  return true;
}

// Guarda varios archivos: en la app se elige una carpeta; en el navegador se descargan uno por uno.
export async function guardarVarios(archivos: { nombre: string; datos: Uint8Array }[]): Promise<boolean> {
  if (enApp) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const carpeta = await open({ directory: true, multiple: false });
    if (!carpeta || Array.isArray(carpeta)) return false;
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
