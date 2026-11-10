// Herramientas de Ozone PDF que trabajan sobre el documento abierto.
// Todo ocurre en el equipo con MuPDF; nada sale a la red.

// ---------- utilidades ----------
function caja(obj, clave) {
  const v = obj.getInheritable(clave);
  if (!v || !v.isArray() || v.length < 4) return null;
  const n = [0, 1, 2, 3].map((i) => v.get(i).asNumber());
  return [Math.min(n[0], n[2]), Math.min(n[1], n[3]), Math.max(n[0], n[2]), Math.max(n[1], n[3])];
}

function rotacion(obj) {
  const r = obj.getInheritable("Rotate");
  return (((r && r.isNumber() ? r.asNumber() : 0) % 360) + 360) % 360;
}

// Asegura que la página tenga su propio diccionario de recursos (no heredado) y lo devuelve.
function recursosPropios(doc, obj) {
  let res = obj.get("Resources");
  if (!res || res.isNull()) {
    const heredado = obj.getInheritable("Resources");
    res = doc.newDictionary();
    if (heredado && !heredado.isNull()) heredado.forEach((v, k) => res.put(k, v));
    obj.put("Resources", res);
  }
  return res.resolve();
}

function subDict(doc, res, clave) {
  let d = res.get(clave);
  if (!d || d.isNull()) {
    d = doc.newDictionary();
    res.put(clave, d);
  }
  return d.resolve();
}

// Agrega dibujo encima del contenido de la página sin alterar lo que ya había.
function dibujarEncima(doc, obj, operaciones) {
  const antes = doc.addStream("q\n", {});
  const despues = doc.addStream("Q\n" + operaciones + "\n", {});
  const c = obj.get("Contents");
  const arr = doc.newArray();
  arr.push(antes);
  if (c && !c.isNull()) {
    const r = c.resolve();
    if (r.isArray()) for (let i = 0; i < r.length; i++) arr.push(r.get(i));
    else arr.push(c);
  }
  arr.push(despues);
  obj.put("Contents", arr);
}

// Pasa un punto de la página tal como se ve (origen abajo a la izquierda) a coordenadas PDF,
// teniendo en cuenta la rotación de la página. Devuelve también la matriz para escribir derecho.
function geometria(obj) {
  const mb = caja(obj, "CropBox") || caja(obj, "MediaBox") || [0, 0, 595, 842];
  const [x0, y0, x1, y1] = mb;
  const r = rotacion(obj);
  const w = x1 - x0, h = y1 - y0;
  const ancho = r % 180 ? h : w, alto = r % 180 ? w : h;
  // matriz que va de "como se ve" a coordenadas PDF
  let m;
  if (r === 90) m = [0, 1, -1, 0, x1, y0];
  else if (r === 180) m = [-1, 0, 0, -1, x1, y1];
  else if (r === 270) m = [0, -1, 1, 0, x0, y1];
  else m = [1, 0, 0, 1, x0, y0];
  return { ancho, alto, m };
}

function num(v) {
  return Math.abs(v) < 1e-6 ? "0" : (+v.toFixed(4)).toString();
}

function latin1(texto) {
  let s = "";
  for (const ch of texto) {
    const c = ch.codePointAt(0);
    const v = c < 256 ? ch : "?";
    s += v === "(" || v === ")" || v === "\\" ? "\\" + v : v;
  }
  return s;
}

// ---------- páginas ----------
export function rotarPagina(doc, i, grados) {
  const obj = doc.findPage(i);
  obj.put("Rotate", (((rotacion(obj) + grados) % 360) + 360) % 360);
}

export function moverPagina(doc, de, a) {
  if (de === a) return;
  const obj = doc.findPage(de);
  doc.deletePage(de);
  doc.insertPage(a, obj);
}

export function borrarPaginas(doc, indices) {
  [...new Set(indices)].sort((x, y) => y - x).forEach((i) => doc.deletePage(i));
}

// "1-3, 5, 8-" → [0,1,2,4,7,...]
export function leerRangos(texto, total) {
  const out = [];
  for (const parte of String(texto).split(/[,;]+/)) {
    const p = parte.trim();
    if (!p) continue;
    const m = p.match(/^(\d*)\s*[-–]\s*(\d*)$/);
    if (m) {
      const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : total;
      if (a < 1 || a > total || b < a || (m[2] && b > total)) return null; // páginas que no existen: se avisa
      for (let k = a; k <= b; k++) out.push(k - 1);
    } else if (/^\d+$/.test(p)) {
      const k = +p;
      if (k < 1 || k > total) return null;
      out.push(k - 1);
    } else return null;
  }
  return out;
}

export function documentoCon(mupdf, doc, indices) {
  const nuevo = new mupdf.PDFDocument();
  const mapa = nuevo.newGraftMap();
  indices.forEach((i, k) => mapa.graftPage(k, doc, i));
  return nuevo;
}

// con clave: la copia sale protegida con la misma contraseña que el original
export function aBytes(d, clave) {
  let opciones = "garbage=compact,compress=yes";
  if (clave && !clave.includes(",")) opciones += `,encrypt=aes-256,user-password=${clave},owner-password=${clave}`;
  const b = d.saveToBuffer(opciones);
  const u = b.asUint8Array().slice();
  b.destroy();
  return u;
}

// ---------- unir ----------
export function unir(mupdf, doc, archivos) {
  for (const datos of archivos) {
    const otro = mupdf.Document.openDocument(datos, "application/pdf");
    if (!(otro instanceof mupdf.PDFDocument)) { otro.destroy(); throw new Error("NO_PDF"); }
    if (otro.needsPassword()) { otro.destroy(); throw new Error("CON_CLAVE"); }
    const mapa = doc.newGraftMap();
    const n = otro.countPages();
    for (let i = 0; i < n; i++) mapa.graftPage(-1, otro, i);
    otro.destroy();
  }
}

// ---------- dividir ----------
export function dividir(mupdf, doc, modo, valor, clave) {
  const total = doc.countPages();
  const grupos = [];
  if (modo === "cada") {
    for (let i = 0; i < total; i++) grupos.push([i]);
  } else if (modo === "rangos") {
    for (const parte of String(valor).split(/;+/)) { // cada archivo va separado por ";" (la coma junta páginas: "1-3, 5")
      const r = leerRangos(parte, total);
      if (r === null) throw new Error("RANGO");
      if (r.length) grupos.push(r);
    }
  } else if (modo === "tamano") {
    const max = Math.max(50 * 1024, valor);
    let actual = [];
    for (let i = 0; i < total; i++) {
      const prueba = [...actual, i];
      const d = documentoCon(mupdf, doc, prueba);
      const tam = aBytes(d).length;
      d.destroy();
      if (tam > max && actual.length) { grupos.push(actual); actual = [i]; }
      else actual = prueba;
    }
    if (actual.length) grupos.push(actual);
  }
  return grupos.map((g) => {
    const d = documentoCon(mupdf, doc, g);
    const datos = aBytes(d, clave);
    d.destroy();
    const desde = g[0] + 1, hasta = g[g.length - 1] + 1;
    return { paginas: g.length, desde, hasta, datos };
  });
}

// ---------- comprimir ----------
const NIVELES = {
  liviana: { max: 2000, q: 82 },
  equilibrada: { max: 1500, q: 72 },
  maxima: { max: 1000, q: 58 },
};

function imagenesDe(res, vistas, lista) {
  if (!res || res.isNull()) return;
  const x = res.resolve().get("XObject");
  if (!x || x.isNull()) return;
  x.resolve().forEach((v) => {
    if (!v.isIndirect()) return;
    const n = v.asIndirect();
    if (vistas.has(n)) return;
    vistas.add(n);
    const o = v.resolve();
    const sub = o.get("Subtype");
    if (sub.isName() && sub.asName() === "Image") lista.push(v);
    else if (sub.isName() && sub.asName() === "Form") imagenesDe(o.get("Resources"), vistas, lista);
  });
}

export function comprimir(mupdf, doc, nivel) {
  const cfg = NIVELES[nivel] || NIVELES.equilibrada;
  const vistas = new Set(), lista = [];
  for (let i = 0; i < doc.countPages(); i++) imagenesDe(doc.findPage(i).getInheritable("Resources"), vistas, lista);
  let achicadas = 0;
  for (const ref of lista) {
    try {
      const o = ref.resolve();
      if (o.get("ImageMask").isBoolean() && o.get("ImageMask").asBoolean()) continue;
      const w = o.get("Width").asNumber(), h = o.get("Height").asNumber();
      if (w * h < 160 * 160) continue;
      const filtro = o.get("Filter");
      const esJpeg = filtro.isName() && filtro.asName() === "DCTDecode";
      const largoAntes = ref.readRawStream().getLength();
      const k = Math.min(1, cfg.max / Math.max(w, h));
      if (esJpeg && k === 1 && nivel !== "maxima") continue;
      const img = doc.loadImage(ref);
      let pix = img.toPixmap();
      const cs = pix.getColorSpace();
      const gris = cs && cs.isGray();
      if (pix.getAlpha() || !cs || !(cs.isRGB() || cs.isGray())) {
        pix = pix.convertToColorSpace(gris ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB, false);
      }
      let nw = w, nh = h;
      if (k < 1) {
        nw = Math.max(1, Math.round(w * k)); nh = Math.max(1, Math.round(h * k));
        pix = pix.warp([[0, 0], [w, 0], [w, h], [0, h]], nw, nh);
      }
      const jpeg = pix.asJPEG(cfg.q);
      if (jpeg.length >= largoAntes * 0.95) continue;
      ref.writeRawStream(jpeg);
      o.put("Filter", doc.newName("DCTDecode"));
      o.put("Width", nw);
      o.put("Height", nh);
      o.put("BitsPerComponent", 8);
      o.put("ColorSpace", doc.newName(gris ? "DeviceGray" : "DeviceRGB"));
      o.delete("DecodeParms");
      o.delete("Decode");
      achicadas++;
    } catch { /* imagen que no se pudo recomprimir: queda como estaba */ }
  }
  return { imagenes: lista.length, achicadas };
}

// ---------- marca de agua (imagen PNG con transparencia, ya rotada) ----------
export function marcaDeAgua(mupdf, doc, png, escala) {
  const img = new mupdf.Image(png);
  const iw = img.getWidth(), ih = img.getHeight();
  const ref = doc.addImage(img);
  for (let i = 0; i < doc.countPages(); i++) {
    const obj = doc.findPage(i);
    const { ancho, alto, m } = geometria(obj);
    const res = recursosPropios(doc, obj);
    subDict(doc, res, "XObject").put("OzMarca", ref);
    const w = ancho * escala, h = (w * ih) / iw;
    const ajuste = h > alto * escala ? (alto * escala) / h : 1;
    const ww = w * ajuste, hh = h * ajuste;
    const x = (ancho - ww) / 2, y = (alto - hh) / 2;
    dibujarEncima(doc, obj, `q ${m.map(num).join(" ")} cm ${num(ww)} 0 0 ${num(hh)} ${num(x)} ${num(y)} cm /OzMarca Do Q`);
  }
}

// ---------- numerar páginas ----------
export function numerar(mupdf, doc, { posicion, formato, tam, desde }) {
  const fuente = new mupdf.Font("Helvetica");
  const fref = doc.addSimpleFont(fuente, "Latin");
  const total = doc.countPages();
  const margen = 28;
  for (let i = 0; i < total; i++) {
    const obj = doc.findPage(i);
    const { ancho, alto, m } = geometria(obj);
    const n = i + (desde || 1);
    const texto = formato === "de" ? `${n} / ${total + (desde || 1) - 1}` : String(n);
    let w = 0;
    for (const ch of texto) w += fuente.advanceGlyph(fuente.encodeCharacter(ch)) * tam;
    let x = (ancho - w) / 2, y = margen - tam * 0.2;
    if (posicion === "abajo-derecha") x = ancho - margen - w;
    if (posicion === "arriba-derecha") { x = ancho - margen - w; y = alto - margen; }
    if (posicion === "arriba-centro") y = alto - margen;
    const res = recursosPropios(doc, obj);
    subDict(doc, res, "Font").put("OzNum", fref);
    dibujarEncima(doc, obj, `q ${m.map(num).join(" ")} cm BT /OzNum ${num(tam)} Tf 0.25 0.26 0.29 rg ${num(x)} ${num(y)} Td (${latin1(texto)}) Tj ET Q`);
  }
}

// ---------- limpiar datos ocultos ----------
export function limpiarDatos(doc) {
  for (const k of ["Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "ModDate"]) {
    try { doc.setMetaData("info:" + k, ""); } catch { /* nada */ }
  }
  const tr = doc.getTrailer();
  tr.delete("Info");
  const raiz = tr.get("Root").resolve();
  raiz.delete("Metadata");
  raiz.delete("PieceInfo");
  const nombres = raiz.get("Names");
  if (nombres && !nombres.isNull()) {
    nombres.resolve().delete("EmbeddedFiles");
    nombres.resolve().delete("JavaScript");
  }
  raiz.delete("OpenAction");
  let notas = 0;
  for (let i = 0; i < doc.countPages(); i++) {
    const p = doc.loadPage(i);
    for (const a of p.getAnnotations()) {
      // las notas con un archivo adjunto (clip) también son adjuntos ocultos: se borran
      if (a.getType() === "FileAttachment") { p.deleteAnnotation(a); notas++; continue; }
      try { if (a.hasAuthor() && a.getAuthor()) { a.setAuthor(""); notas++; } } catch { /* nada */ }
    }
    doc.findPage(i).delete("PieceInfo");
  }
  return { notas };
}

// ---------- exportar ----------
export function aImagenes(mupdf, doc, dpi, formato) {
  const out = [];
  const k = dpi / 72;
  for (let i = 0; i < doc.countPages(); i++) {
    const pix = doc.loadPage(i).toPixmap(mupdf.Matrix.scale(k, k), mupdf.ColorSpace.DeviceRGB, false, true);
    const datos = formato === "png" ? pix.asPNG() : pix.asJPEG(88);
    out.push({ pagina: i + 1, datos: datos.slice() });
    pix.destroy();
  }
  return out;
}

export function aTexto(doc) {
  const partes = [];
  for (let i = 0; i < doc.countPages(); i++) {
    const st = doc.loadPage(i).toStructuredText("preserve-whitespace");
    partes.push(st.asText().trimEnd());
    st.destroy();
  }
  return partes;
}

// ---------- OCR: hacer buscable un PDF escaneado ----------
// Dibuja una página como imagen para leerla. Si la página ya tiene texto, se avisa para no duplicarlo.
export function paginaParaOcr(mupdf, doc, i, dpi) {
  const pag = doc.loadPage(i);
  const st = pag.toStructuredText();
  const conTexto = st.asText().replace(/\s+/g, "").length > 15;
  st.destroy();
  const b = pag.getBounds();
  let k = dpi / 72;
  const lado = Math.max(b[2] - b[0], b[3] - b[1]) * k;
  if (lado > 4500) k *= 4500 / lado; // páginas enormes: se limita para no quedarse sin memoria
  const pix = pag.toPixmap(mupdf.Matrix.scale(k, k), mupdf.ColorSpace.DeviceRGB, false, true);
  const png = pix.asPNG().slice();
  pix.destroy();
  return { png, conTexto, dpi: k * 72 };
}

// Pega encima de la página i el texto invisible que armó el OCR (un PDF de una página con solo texto).
// La página se ve igual; el texto queda debajo de la imagen para buscar (Ctrl+F), seleccionar y copiar.
export function agregarCapaTexto(mupdf, doc, i, bytes) {
  const fuente = mupdf.Document.openDocument(bytes, "application/pdf").asPDF();
  try {
    const sobj = fuente.findPage(0);
    const mb = sobj.getInheritable("MediaBox");
    const wt = mb.get(2).asNumber() - mb.get(0).asNumber(), ht = mb.get(3).asNumber() - mb.get(1).asNumber();
    const c = sobj.get("Contents"); // ojo: un stream se lee desde la referencia, no desde el objeto resuelto
    const trozos = [];
    const lista = c.resolve();
    if (lista.isArray()) for (let k = 0; k < lista.length; k++) trozos.push(lista.get(k).readStream().asUint8Array().slice());
    else trozos.push(c.readStream().asUint8Array().slice());
    const total = trozos.reduce((s, t) => s + t.length + 1, 0);
    const contenido = new Uint8Array(total);
    let o = 0;
    for (const t of trozos) { contenido.set(t, o); o += t.length; contenido[o++] = 10; }
    const injerto = doc.newGraftMap();
    const recursos = injerto.graftObject(sobj.getInheritable("Resources"));
    const caja = doc.newArray();
    [0, 0, wt, ht].forEach((v) => caja.push(v));
    const forma = doc.addStream(contenido, { Type: doc.newName("XObject"), Subtype: doc.newName("Form"), BBox: caja, Resources: recursos });
    const obj = doc.findPage(i);
    const { ancho, alto, m } = geometria(obj);
    const nombre = `OzOcr${i}`;
    subDict(doc, recursosPropios(doc, obj), "XObject").put(nombre, forma);
    dibujarEncima(doc, obj, `q ${m.map(num).join(" ")} cm ${num(ancho / wt)} 0 0 ${num(alto / ht)} 0 0 cm /${nombre} Do Q`);
  } finally {
    fuente.destroy();
  }
}
