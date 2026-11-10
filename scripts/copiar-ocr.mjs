// Copia el motor de reconocimiento de texto (Tesseract) y los idiomas a public/ocr, para que
// la app los tenga adentro y nunca los pida a internet. Se ejecuta solo antes de "dev" y "build".
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const req = createRequire(import.meta.url);
const raiz = (paquete) => dirname(req.resolve(`${paquete}/package.json`));
const destino = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "ocr");
mkdirSync(join(destino, "lang"), { recursive: true });

const copiar = (de, a) => { if (!existsSync(a)) cpSync(de, a); };
copiar(join(raiz("tesseract.js"), "dist", "worker.min.js"), join(destino, "worker.min.js"));
copiar(join(raiz("tesseract.js-core"), "tesseract-core-simd-lstm.wasm.js"), join(destino, "tesseract-core-simd-lstm.wasm.js"));
for (const l of ["spa", "eng", "deu", "chi_sim", "jpn", "rus"])
  copiar(join(raiz(`@tesseract.js-data/${l}`), "4.0.0_best_int", `${l}.traineddata.gz`), join(destino, "lang", `${l}.traineddata.gz`));
console.log("OCR listo en public/ocr");
