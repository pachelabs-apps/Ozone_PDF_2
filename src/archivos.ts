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
