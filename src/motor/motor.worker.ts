// Motor PDF de Ozone PDF 2. Corre en un Worker aparte para que la pantalla no se trabe.
// Todo sucede en el dispositivo: este código no hace ninguna conexión de red.
import * as mupdf from "mupdf";
// @ts-ignore módulo JS propio
import { ajustarPaginas, agregarImagenes } from "./paginas.js";
import * as H from "./herramientas.js";

type Punto = [number, number];
type Rect = [number, number, number, number];

let doc: mupdf.PDFDocument | null = null;
const instantaneas: Uint8Array[] = [];
let original: Uint8Array | null = null; // el archivo tal como está en disco (para revisar la firma)

// ---------- seguridad: firma digital, restricciones y adjuntos (como en Ozone PDF 1) ----------
// Firma "valida": al menos una firma cubre el archivo completo (no se modificó después de firmar).
// "alterada": hay datos de firma pero el archivo se reescribió después: para Acrobat ya no vale.
// No reemplaza la verificación criptográfica de Acrobat, pero detecta cualquier copia modificada.
function firmaCubreArchivo(v: mupdf.PDFObject) {
  try {
    const br = v.get("ByteRange");
    if (!original || !br.isArray() || br.length < 4) return false;
    const [a, b, c, d] = [0, 1, 2, 3].map((i) => br.get(i).asNumber());
    if (a !== 0 || b <= 0 || c <= b || c + d !== original.length) return false;
    return original[b] === 0x3c && original[c - 1] === 0x3e; // "<" y ">" del contenido de la firma
  } catch { return false; }
}
function seguridad() {
  const d = documento();
  const t = d.getTrailer();
  let cifrado = false;
  try { cifrado = !t.get("Encrypt").isNull(); } catch { /* nada */ }
  const permisos = { editar: d.hasPermission("edit"), anotar: d.hasPermission("annotate"), copiar: d.hasPermission("copy"), imprimir: d.hasPermission("print") };
  let firma: null | "valida" | "alterada" = null;
  try {
    const campos = t.get("Root").get("AcroForm").get("Fields");
    const firmas: mupdf.PDFObject[] = [];
    const vistos = new Set<number>();
    const recorrer = (o: mupdf.PDFObject, ftPadre: string, nivel: number) => {
      if (nivel > 20 || o.isNull()) return;
      if (o.isIndirect()) { const n = o.asIndirect(); if (vistos.has(n)) return; vistos.add(n); }
      const ft = o.get("FT");
      const tipo = ft.isName() ? ft.asName() : ftPadre;
      const v = o.get("V");
      if (tipo === "Sig" && v.isDictionary()) firmas.push(v);
      const hijos = o.get("Kids");
      if (hijos.isArray()) for (let i = 0; i < hijos.length; i++) recorrer(hijos.get(i), tipo, nivel + 1);
    };
    if (campos.isArray()) for (let i = 0; i < campos.length; i++) recorrer(campos.get(i), "", 0);
    if (firmas.length) firma = firmas.some(firmaCubreArchivo) ? "valida" : "alterada";
  } catch { /* sin formulario */ }
  let adjuntos = 0;
  try { adjuntos = Object.keys(d.getEmbeddedFiles()).length; } catch { /* nada */ }
  return { firma, cifrado, restringido: cifrado && !permisos.editar, permisos, adjuntos };
}

function documento(): mupdf.PDFDocument {
  if (!doc) throw new Error("NO_DOC");
  return doc;
}

function idDe(a: mupdf.PDFAnnotation): number {
  return a.getObject().asIndirect();
}

function buscar(pagina: number, id: number) {
  const p = documento().loadPage(pagina);
  const a = p.getAnnotations().find((x) => idDe(x) === id);
  if (!a) throw new Error("NO_ANOT");
  return { p, a };
}

function info() {
  const d = documento();
  const paginas = [];
  for (let i = 0; i < d.countPages(); i++) {
    const b = d.loadPage(i).getBounds();
    paginas.push({ w: b[2] - b[0], h: b[3] - b[1], x0: b[0], y0: b[1] });
  }
  return { paginas, titulo: d.getMetaData("info:Title") || "" };
}

function etiqueta(a: mupdf.PDFAnnotation) {
  const tipo = a.getType();
  let r: Rect;
  try {
    r = a.getBounds() as Rect;
  } catch {
    r = a.getRect() as Rect;
  }
  return { id: idDe(a), tipo, r };
}

const MOVIBLES = new Set(["Stamp", "FreeText", "Square", "Circle", "Redact", "Ink", "Highlight", "Underline", "StrikeOut"]);
const REDIMENSIONABLES = new Set(["Stamp", "FreeText", "Square", "Circle", "Redact"]);

const ops: Record<string, (a: any) => any> = {
  abrir({ datos }: { datos: ArrayBuffer }) {
    instantaneas.length = 0;
    doc?.destroy();
    doc = null;
    const d = mupdf.Document.openDocument(new Uint8Array(datos), "application/pdf");
    if (!(d instanceof mupdf.PDFDocument)) {
      d.destroy();
      throw new Error("NO_PDF");
    }
    doc = d;
    original = new Uint8Array(datos);
    if (d.needsPassword()) return { necesitaClave: true };
    return { ...info(), seguridad: seguridad() };
  },

  cerrar() { instantaneas.length = 0; doc?.destroy(); doc = null; original = null; return true; },

  clave({ clave }: { clave: string }) {
    const ok = documento().authenticatePassword(clave);
    if (!ok) return { incorrecta: true };
    return { ...info(), seguridad: seguridad() };
  },

  render({ pagina, escala }: { pagina: number; escala: number }) {
    const p = documento().loadPage(pagina);
    const pix = p.toPixmap(mupdf.Matrix.scale(escala, escala), mupdf.ColorSpace.DeviceRGB, true, true);
    const w = pix.getWidth(), h = pix.getHeight();
    const pixeles = new Uint8ClampedArray(pix.getPixels()); // copia fuera de la memoria del motor
    pix.destroy();
    return { w, h, pixeles, __transferir: [pixeles.buffer] };
  },

  anotaciones({ pagina }: { pagina: number }) {
    const p = documento().loadPage(pagina);
    return p.getAnnotations()
      .filter((a) => a.getType() !== "Popup" && a.getType() !== "Widget" && a.getType() !== "Link")
      .map((a) => ({ ...etiqueta(a), movible: MOVIBLES.has(a.getType()), redimensionable: REDIMENSIONABLES.has(a.getType()) }));
  },

  // Resalta el texto que hay entre dos puntos, como al seleccionar con el mouse.
  resaltar({ pagina, a, b, color, tipo }: { pagina: number; a: Punto; b: Punto; color: number[]; tipo?: string }) {
    const p = documento().loadPage(pagina);
    const st = p.toStructuredText("preserve-whitespace");
    const quads = st.highlight(a, b, 500);
    st.destroy();
    if (!quads.length) return null;
    const an = p.createAnnotation((tipo as mupdf.PDFAnnotationType) || "Highlight");
    an.setColor(color as mupdf.AnnotColor);
    an.setQuadPoints(quads);
    an.update();
    return etiqueta(an);
  },

  texto({ pagina, x, y, texto, tam, color }: { pagina: number; x: number; y: number; texto: string; tam: number; color: number[] }) {
    const p = documento().loadPage(pagina);
    const lineas = texto.split("\n");
    const largo = Math.max(...lineas.map((l) => l.length), 1);
    const w = Math.max(largo * tam * 0.56 + 6, 30);
    const h = lineas.length * tam * 1.25 + 6;
    const an = p.createAnnotation("FreeText");
    an.setRect([x, y, x + w, y + h]);
    an.setDefaultAppearance("Helv", tam, color as mupdf.AnnotColor);
    an.setBorderWidth(0);
    an.setContents(texto);
    an.update();
    return etiqueta(an);
  },

  rectangulo({ pagina, r, color }: { pagina: number; r: Rect; color: number[] }) {
    const p = documento().loadPage(pagina);
    const an = p.createAnnotation("Square");
    an.setRect(r);
    an.setColor(color as mupdf.AnnotColor);
    an.setBorderWidth(2);
    an.update();
    return etiqueta(an);
  },

  tinta({ pagina, trazos, color, ancho }: { pagina: number; trazos: Punto[][]; color: number[]; ancho: number }) {
    const p = documento().loadPage(pagina);
    const an = p.createAnnotation("Ink");
    an.setInkList(trazos);
    an.setColor(color as mupdf.AnnotColor);
    an.setBorderWidth(ancho);
    an.update();
    return etiqueta(an);
  },

  firma({ pagina, r, png }: { pagina: number; r: Rect; png: Uint8Array }) {
    const d = documento();
    const p = d.loadPage(pagina);
    const img = new mupdf.Image(png);
    const an = p.createAnnotation("Stamp");
    an.setRect(r);
    an.setStampImage(img);
    an.update();
    return etiqueta(an);
  },

  censurar({ pagina, r }: { pagina: number; r: Rect }) {
    const p = documento().loadPage(pagina);
    const an = p.createAnnotation("Redact");
    an.setRect(r);
    an.update();
    return etiqueta(an);
  },

  // Borra de verdad lo que está debajo de cada censura (texto, imágenes y dibujos).
  aplicarCensura() {
    const d = documento();
    const cambiadas: number[] = [];
    for (let i = 0; i < d.countPages(); i++) {
      const p = d.loadPage(i);
      if (p.getAnnotations().some((a) => a.getType() === "Redact")) {
        p.applyRedactions(true, 2);
        cambiadas.push(i);
      }
    }
    return cambiadas;
  },

  censurasPendientes() {
    const d = documento();
    let n = 0;
    for (let i = 0; i < d.countPages(); i++)
      n += d.loadPage(i).getAnnotations().filter((a) => a.getType() === "Redact").length;
    return n;
  },

  mover({ pagina, id, dx, dy }: { pagina: number; id: number; dx: number; dy: number }) {
    const { a } = buscar(pagina, id);
    if (a.hasInkList()) {
      a.setInkList(a.getInkList().map((t) => t.map(([x, y]) => [x + dx, y + dy] as Punto)));
    } else if (a.hasQuadPoints()) {
      a.setQuadPoints(a.getQuadPoints().map((q) => q.map((v, i) => v + (i % 2 ? dy : dx)) as mupdf.Quad));
    } else {
      const [x0, y0, x1, y1] = a.getRect();
      a.setRect([x0 + dx, y0 + dy, x1 + dx, y1 + dy]);
    }
    a.update();
    return etiqueta(a);
  },

  ajustar({ pagina, id, r }: { pagina: number; id: number; r: Rect }) {
    const { a } = buscar(pagina, id);
    a.setRect(r);
    a.update();
    return etiqueta(a);
  },

  borrar({ pagina, id }: { pagina: number; id: number }) {
    const { p, a } = buscar(pagina, id);
    p.deleteAnnotation(a);
    return true;
  },

  // ---------- deshacer cambios grandes (páginas, herramientas): se guarda una copia antes ----------
  instantanea() {
    const buf = documento().saveToBuffer("encrypt=none");
    const copia = buf.asUint8Array().slice();
    buf.destroy();
    instantaneas.push(copia);
    let total = instantaneas.reduce((n, x) => n + x.length, 0);
    while (instantaneas.length > 1 && (instantaneas.length > 12 || total > 150 * 1024 * 1024)) total -= instantaneas.shift()!.length;
    return true;
  },
  restaurar() {
    const copia = instantaneas.pop();
    if (!copia) throw new Error("SIN_COPIA");
    doc?.destroy();
    doc = mupdf.Document.openDocument(copia, "application/pdf") as mupdf.PDFDocument;
    return info();
  },
  olvidarInstantaneas() { instantaneas.length = 0; return true; },

  // ---------- herramientas ----------
  rotarPagina({ i, grados }: { i: number; grados: number }) { H.rotarPagina(documento(), i, grados); return info(); },
  moverPagina({ de, a }: { de: number; a: number }) { H.moverPagina(documento(), de, a); return info(); },
  borrarPaginas({ indices }: { indices: number[] }) {
    if (indices.length >= documento().countPages()) throw new Error("TODAS");
    H.borrarPaginas(documento(), indices); return info();
  },
  unir({ archivos }: { archivos: Uint8Array[] }) {
    if (!doc) doc = new mupdf.PDFDocument();
    H.unir(mupdf, doc, archivos); return info();
  },
  dividir({ modo, valor }: { modo: string; valor: any }) {
    const partes = H.dividir(mupdf, documento(), modo, valor);
    return { partes, __transferir: partes.map((p) => p.datos.buffer) };
  },
  // rotar, borrar u ordenar varias páginas a la vez (como en Ozone PDF 1)
  rotarRangos({ rangos, grados }: { rangos: string; grados: number }) {
    const d = documento(), n = d.countPages();
    const lista = rangos.trim() ? H.leerRangos(rangos, n) : [...Array(n).keys()];
    if (!lista || !lista.length) throw new Error("RANGO");
    for (const i of new Set(lista)) H.rotarPagina(d, i, grados);
    return { ...info(), cambiadas: new Set(lista).size };
  },
  borrarRangos({ rangos }: { rangos: string }) {
    const d = documento(), n = d.countPages();
    const lista = H.leerRangos(rangos, n);
    if (!lista || !lista.length) throw new Error("RANGO");
    if (new Set(lista).size >= n) throw new Error("TODAS");
    H.borrarPaginas(d, lista);
    return { ...info(), cambiadas: new Set(lista).size };
  },
  // las páginas nombradas pasan adelante en ese orden; las demás quedan después, como estaban.
  // "invertir" da vuelta todo el documento.
  reordenar({ orden, invertir }: { orden: string; invertir?: boolean }) {
    const d = documento(), n = d.countPages();
    let destino: number[];
    if (invertir) destino = [...Array(n).keys()].reverse();
    else {
      const lista = H.leerRangos(orden, n);
      if (!lista || !lista.length) throw new Error("RANGO");
      const primero = [...new Set(lista)];
      destino = [...primero, ...[...Array(n).keys()].filter((i) => !primero.includes(i))];
    }
    const actual = [...Array(n).keys()];
    destino.forEach((pag, k) => {
      const j = actual.indexOf(pag);
      if (j !== k) { H.moverPagina(d, j, k); actual.splice(k, 0, actual.splice(j, 1)[0]); }
    });
    return info();
  },
  extraer({ rangos }: { rangos: string }) {
    const lista = H.leerRangos(rangos, documento().countPages());
    if (!lista || !lista.length) throw new Error("RANGO");
    const d = H.documentoCon(mupdf, documento(), lista);
    const datos = H.aBytes(d); d.destroy();
    return { datos, paginas: lista.length, __transferir: [datos.buffer] };
  },
  comprimir({ nivel }: { nivel: string }) {
    const d = documento();
    const antes = H.aBytes(d).length;
    const r = H.comprimir(mupdf, d, nivel);
    const despues = H.aBytes(d).length;
    return { ...r, antes, despues, ...info() };
  },
  tamanoActual() { return H.aBytes(documento()).length; },
  marcaDeAgua({ png, escala }: { png: Uint8Array; escala: number }) { H.marcaDeAgua(mupdf, documento(), png, escala); return info(); },
  numerar(o: { posicion: string; formato: string; tam: number; desde: number }) { H.numerar(mupdf, documento(), o); return info(); },
  limpiarDatos() { return H.limpiarDatos(documento()); },
  aImagenes({ dpi, formato }: { dpi: number; formato: string }) {
    const lista = H.aImagenes(mupdf, documento(), dpi, formato);
    return { lista, __transferir: lista.map((x) => x.datos.buffer) };
  },
  aTexto() { return H.aTexto(documento()); },
  paginaParaOcr({ i, dpi }: { i: number; dpi: number }) {
    const r = H.paginaParaOcr(mupdf, documento(), i, dpi);
    return { ...r, __transferir: [r.png.buffer] };
  },
  agregarCapaTexto({ i, pdf }: { i: number; pdf: Uint8Array }) { H.agregarCapaTexto(mupdf, documento(), i, pdf); return true; },

  guardar({ clave, quitarClave }: { clave?: string; quitarClave?: boolean } = {}) {
    let opciones = "garbage=compact,compress=yes";
    if (clave) opciones += `,encrypt=aes-256,user-password=${clave},owner-password=${clave}`;
    else if (quitarClave) opciones += ",encrypt=none";
    const buf = documento().saveToBuffer(opciones);
    const datos = new Uint8Array(buf.asUint8Array());
    buf.destroy();
    return { datos, __transferir: [datos.buffer] };
  },

  // Deja todas las páginas del mismo tamaño (A4 o Carta), con márgenes opcionales.
  ajustarPaginas({ tamano, margen, orientacion }: { tamano: string; margen: number; orientacion: string }) {
    const n = ajustarPaginas(mupdf, documento(), { tamano, margen, orientacion });
    return { cambiadas: n, ...info() };
  },

  // Crea un PDF nuevo con fotos escaneadas, o las agrega al final del abierto.
  desdeImagenes({ imagenes, anexar, tamano }: { imagenes: Uint8Array[]; anexar: boolean; tamano?: string }) {
    if (!anexar || !doc) {
      instantaneas.length = 0;
      doc?.destroy();
      doc = new mupdf.PDFDocument();
    }
    agregarImagenes(mupdf, doc, imagenes, { tamano: tamano || "a4", margen: 0 });
    return info();
  },

  // ¿Las páginas tienen tamaños muy distintos entre sí?
  tamanosMezclados() {
    const d = documento();
    const areas: number[] = [];
    for (let i = 0; i < d.countPages(); i++) {
      const b = d.loadPage(i).getBounds();
      areas.push((b[2] - b[0]) * (b[3] - b[1]));
    }
    return areas.length > 1 && Math.max(...areas) / Math.min(...areas) > 1.6;
  },
};

self.onmessage = (e: MessageEvent<{ id: number; op: string; args: any }>) => {
  const { id, op, args } = e.data;
  try {
    const r = ops[op](args || {});
    const transferir = r && r.__transferir;
    if (transferir) delete r.__transferir;
    (self as unknown as Worker).postMessage({ id, ok: true, r }, transferir || []);
  } catch (err: any) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};

(self as unknown as Worker).postMessage({ listo: true });
