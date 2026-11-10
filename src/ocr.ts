// Reconocimiento de texto (OCR) con Tesseract, todo dentro de la app.
// El motor y los idiomas vienen en /ocr (los copia scripts/copiar-ocr.mjs al compilar):
// nunca se descarga nada de internet, y la política de seguridad tampoco lo permitiría.
import { createWorker, type Worker } from "tesseract.js";
import type { Idioma } from "./i18n";

export type IdiomaOcr = "spa" | "eng" | "deu" | "chi_sim" | "jpn" | "rus";

export const IDIOMAS_OCR: { id: IdiomaOcr; nombre: string }[] = [
  { id: "spa", nombre: "Español" },
  { id: "eng", nombre: "English" },
  { id: "deu", nombre: "Deutsch" },
  { id: "chi_sim", nombre: "中文" },
  { id: "jpn", nombre: "日本語" },
  { id: "rus", nombre: "Русский" },
];

const DE_LA_APP: Record<Idioma, IdiomaOcr> = { es: "spa", en: "eng", de: "deu", zh: "chi_sim", ja: "jpn", ru: "rus" };
export const ocrDeLaApp = (i: Idioma) => DE_LA_APP[i] || "spa";

let lector: Worker | null = null;
let idiomaActual = "";
let avance: ((p: number) => void) | null = null;

async function preparar(idioma: IdiomaOcr) {
  if (lector && idiomaActual === idioma) return lector;
  await lector?.terminate();
  lector = null;
  lector = await createWorker(idioma, 1 /* LSTM */, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/tesseract-core-simd-lstm.wasm.js",
    langPath: "/ocr/lang",
    gzip: true,
    workerBlobURL: false,
    cacheMethod: "none",
    logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text" && avance) avance(m.progress); },
  });
  idiomaActual = idioma;
  return lector;
}

export function alAvanzar(f: ((p: number) => void) | null) { avance = f; }

// Devuelve el texto de una imagen (JPG, PNG…).
export async function leerTexto(imagen: Uint8Array, idioma: IdiomaOcr) {
  const w = await preparar(idioma);
  await w.setParameters({ user_defined_dpi: "300" });
  const r = await w.recognize(new Blob([imagen as BlobPart]));
  return { texto: r.data.text.trim(), confianza: r.data.confidence };
}

// Lee una página ya pasada a imagen y devuelve un PDF de una página con solo el texto invisible,
// del tamaño exacto de la página (por eso se le indica la resolución con la que se dibujó).
export async function capaDeTexto(png: Uint8Array, dpi: number, idioma: IdiomaOcr) {
  const w = await preparar(idioma);
  await w.setParameters({ user_defined_dpi: String(Math.round(dpi)) });
  const r = await w.recognize(new Blob([png as BlobPart]), { pdfTitle: "", pdfTextOnly: true }, { pdf: true, text: true });
  return { pdf: new Uint8Array(r.data.pdf as unknown as ArrayLike<number>), palabras: (r.data.text || "").trim().split(/\s+/).filter(Boolean).length };
}

export async function cerrarOcr() { await lector?.terminate(); lector = null; idiomaActual = ""; }
