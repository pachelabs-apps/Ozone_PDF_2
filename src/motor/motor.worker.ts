// Motor PDF de Ozone PDF 2. Corre en un Worker aparte para que la pantalla no se trabe.
// Todo sucede en el dispositivo: este código no hace ninguna conexión de red.
import * as mupdf from "mupdf";

type Punto = [number, number];
type Rect = [number, number, number, number];

let doc: mupdf.PDFDocument | null = null;

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
    doc?.destroy();
    doc = null;
    const d = mupdf.Document.openDocument(new Uint8Array(datos), "application/pdf");
    if (!(d instanceof mupdf.PDFDocument)) {
      d.destroy();
      throw new Error("NO_PDF");
    }
    doc = d;
    if (d.needsPassword()) return { necesitaClave: true };
    return info();
  },

  clave({ clave }: { clave: string }) {
    const ok = documento().authenticatePassword(clave);
    if (!ok) return { incorrecta: true };
    return info();
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

  guardar() {
    const buf = documento().saveToBuffer("garbage=compact,compress=yes");
    const datos = new Uint8Array(buf.asUint8Array());
    buf.destroy();
    return { datos, __transferir: [datos.buffer] };
  },

  cerrar() {
    doc?.destroy();
    doc = null;
    return true;
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
