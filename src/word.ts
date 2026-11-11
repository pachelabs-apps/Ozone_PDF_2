// Word ↔ PDF, todo dentro de la app (sin internet).
// - Word → PDF: mammoth lee el .docx y lo pasa a HTML con títulos, negritas, listas, tablas e imágenes;
//   el motor de PDF arma las páginas (ver desdeHtml en el motor).
// - PDF → Word: el motor saca el texto de cada página con su tamaño, negrita, cursiva y color, y las
//   imágenes; acá se arma el .docx (un .zip con XML) a mano, sin librerías.

export type Hoja = "a4" | "carta";

// ---------------------------------------------------------------- Word → HTML
const ESTILO = `
@page { margin: 2.2cm 2cm; }
body { font-family: sans-serif; font-size: 11pt; line-height: 1.35; margin: 0; color: #111; }
p { margin: 0 0 6pt; }
h1 { font-size: 18pt; margin: 10pt 0 6pt; } h1.titulo { font-size: 26pt; margin-top: 0; }
h2 { font-size: 15pt; margin: 9pt 0 5pt; } h3 { font-size: 13pt; margin: 8pt 0 4pt; }
h4, h5, h6 { font-size: 11.5pt; margin: 7pt 0 3pt; }
p.subtitulo { font-size: 14pt; color: #555; }
ul, ol { margin: 0 0 6pt; padding-left: 18pt; } li { margin: 0 0 2pt; }
table { border-collapse: collapse; margin: 4pt 0 8pt; }
td, th { border: 1px solid #555; padding: 3pt 6pt; vertical-align: top; } td p, th p { margin: 0; }
img { max-width: 100%; }
blockquote { margin: 0 0 6pt 18pt; color: #444; }
`;

// Devuelve el documento en partes: cada salto de página del Word empieza una parte nueva.
export async function wordAHtml(datos: Uint8Array): Promise<string[]> {
  const mammoth = (await import("mammoth/mammoth.browser.min.js")).default as {
    convertToHtml(e: { arrayBuffer: ArrayBuffer }, o: { styleMap: string[] }): Promise<{ value: string }>;
  };
  const copia = datos.slice().buffer as ArrayBuffer;
  const r = await mammoth.convertToHtml({ arrayBuffer: copia }, {
    styleMap: [
      "p[style-name='Title'] => h1.titulo:fresh",
      "p[style-name='Título'] => h1.titulo:fresh",
      "p[style-name='Subtitle'] => p.subtitulo:fresh",
      "p[style-name='Subtítulo'] => p.subtitulo:fresh",
      "br[type='page'] => hr.ozone-salto",
    ],
  });
  const cuerpo = r.value.replace(/<p>\s*(<hr class="ozone-salto" \/>)\s*<\/p>/g, "$1");
  const partes = cuerpo.split(/<hr class="ozone-salto" \/>/).map((x) => x.trim()).filter((x, i, a) => x || a.length === 1);
  return partes.map((x) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${ESTILO}</style></head><body>${x || "<p></p>"}</body></html>`);
}

// ---------------------------------------------------------------- PDF → Word
export type Corrida = { t: string; b: boolean; i: boolean; tam: number; color: string; fuente: string; x0?: number; x1?: number };
export type Linea = { x0: number; y0: number; x1: number; y1: number; corridas: Corrida[] };
export type Bloque =
  | { tipo: "t"; x0: number; y0: number; x1: number; y1: number; lineas: Linea[] }
  | { tipo: "i"; x0: number; y0: number; x1: number; y1: number; png: Uint8Array; w: number; h: number };
export type PaginaWord = { w: number; h: number; bloques: Bloque[] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  // caracteres de control que Word no acepta en el XML
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const tw = (pt: number) => Math.max(0, Math.round(pt * 20));   // puntos → veinteavos de punto (twips)
const emu = (pt: number) => Math.max(1, Math.round(pt * 12700)); // puntos → EMU (imágenes)

function corridaXml(c: Corrida) {
  const props = [
    c.fuente ? `<w:rFonts w:ascii="${esc(c.fuente)}" w:hAnsi="${esc(c.fuente)}" w:cs="${esc(c.fuente)}"/>` : "",
    c.b ? "<w:b/>" : "", c.i ? "<w:i/>" : "",
    c.color && c.color !== "000000" ? `<w:color w:val="${c.color}"/>` : "",
    `<w:sz w:val="${Math.max(2, Math.round(c.tam * 2))}"/>`,
  ].join("");
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${esc(c.t)}</w:t></w:r>`;
}

// junta corridas seguidas con el mismo formato (menos XML y Word queda más prolijo)
function compactar(cs: Corrida[]) {
  const out: Corrida[] = [];
  for (const c of cs) {
    const u = out[out.length - 1];
    if (u && u.b === c.b && u.i === c.i && Math.abs(u.tam - c.tam) < 0.3 && u.color === c.color && u.fuente === c.fuente) u.t += c.t;
    else out.push({ ...c });
  }
  return out;
}

const VINETA = /^\s*([•●▪◦○■\-–—*]|\d{1,3}[.)]|[a-zA-Z][.)])\s/;
// viñetas que Word guarda con letras de la fuente Symbol/Wingdings (zona privada de Unicode)
const VINETA_PRIVADA = /[\uf0b7\uf0a7\uf076\uf0d8\uf0fc\uf0a8\uf06e\uf0e0]/g;
const SOLO_VINETA = /^\s*[•●▪◦○■*]\s*$/; // las rayas no: suelen ser parte del texto
const textoDe = (l: Linea) => l.corridas.map((c) => c.t).join("");
const solapan = (a: Linea, b: Linea) => {
  const comun = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return comun >= 0.5 * Math.min(a.y1 - a.y0, b.y1 - b.y0);
};
const tamDe = (l: Linea) => Math.max(...l.corridas.map((c) => c.tam));

// Acomoda lo que sale del PDF antes de armar los párrafos:
// - la viñeta suelta (que el PDF guarda como otro texto, a veces en otro bloque) se pega a su renglón;
// - los pedazos de un mismo renglón (otra fuente, otro alfabeto) se juntan en orden de izquierda a derecha.
function acomodar(pg: PaginaWord): PaginaWord {
  const bloques = pg.bloques.map((b) => b.tipo !== "t" ? b : {
    ...b, lineas: b.lineas.map((l) => ({ ...l, corridas: l.corridas.map((c) => ({ ...c, t: c.t.replace(VINETA_PRIVADA, "•") })) })),
  });
  const todas = bloques.flatMap((b) => b.tipo === "t" ? b.lineas : []);
  const sacar = new Set<Linea>();
  for (const l of todas) {
    if (!SOLO_VINETA.test(textoDe(l))) continue;
    let mejor: Linea | null = null;
    for (const m of todas) {
      if (m === l || sacar.has(m) || SOLO_VINETA.test(textoDe(m)) || !solapan(l, m)) continue;
      const gap = m.x0 - l.x1;
      if (gap > -1 && gap < 60 && (!mejor || m.x0 < mejor.x0)) mejor = m;
    }
    if (!mejor) continue;
    const f = mejor.corridas[0];
    mejor.corridas.unshift({ ...f, t: "• " });
    mejor.x0 = l.x0;
    sacar.add(l);
  }
  // pedazos del mismo renglón: si están en otro bloque (pasa con otra fuente u otro alfabeto)
  // o seguidos en el mismo, se juntan ordenados por su posición
  const juntar = (a: Linea, b: Linea): Linea => {
    const cs = [...a.corridas, ...b.corridas].map((c) => ({ ...c }));
    cs.sort((x, y) => (x.x0 ?? 0) - (y.x0 ?? 0));
    for (let k = 1; k < cs.length; k++) {
      const ant = cs[k - 1], c = cs[k];
      if ((c.x0 ?? 0) - (ant.x1 ?? 0) > 1.5 && !/\s$/.test(ant.t) && !/^\s/.test(c.t)) ant.t += " ";
    }
    for (const c of cs) c.t = c.t.replace(/\s{2,}/g, " ");
    return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), corridas: cs };
  };
  const cerca = (a: Linea, b: Linea) => solapan(a, b) && b.x0 - a.x1 < 15 && a.x0 - b.x1 < 15;
  const textos = bloques.filter((b): b is Extract<Bloque, { tipo: "t" }> => b.tipo === "t")
    .map((b) => ({ ...b, lineas: b.lineas.filter((l) => !sacar.has(l)) }));
  // cada renglón de un bloque posterior que cae en el mismo renglón que uno anterior se suma a ese
  for (let j = 1; j < textos.length; j++) {
    textos[j].lineas = textos[j].lineas.filter((l) => {
      for (let i = 0; i < j; i++) {
        const k = textos[i].lineas.findIndex((m) => cerca(m, l));
        if (k >= 0) { textos[i].lineas[k] = juntar(textos[i].lineas[k], l); return false; }
      }
      return true;
    });
  }
  const salida: Bloque[] = [];
  let ti = 0;
  for (const b of bloques) {
    if (b.tipo !== "t") { salida.push(b); continue; }
    const t = textos[ti++]; // mismo orden que los bloques de texto
    // dentro del bloque los pedazos de un renglón pueden venir desordenados: se juntan todos
    const juntas: Linea[] = [];
    for (const l of t.lineas) {
      let actual = l;
      for (let k = juntas.length - 1; k >= 0; k--) {
        if (cerca(juntas[k], actual)) { actual = juntar(juntas[k], actual); juntas.splice(k, 1); }
      }
      juntas.push(actual);
    }
    juntas.sort((x, y) => x.y0 - y.y0 || x.x0 - y.x0);
    if (!juntas.length) continue;
    salida.push({ ...t, x0: Math.min(...juntas.map((l) => l.x0)), x1: Math.max(...juntas.map((l) => l.x1)), lineas: juntas });
  }
  return { ...pg, bloques: salida };
}

export function armarDocx(paginas: PaginaWord[]): Uint8Array {
  paginas = paginas.map(acomodar);
  const imagenes: { nombre: string; datos: Uint8Array }[] = [];
  const cuerpo: string[] = [];
  // márgenes y ancho útil a partir de la primera página con contenido
  const ref = paginas.find((p) => p.bloques.length) || paginas[0] || { w: 595, h: 842, bloques: [] };
  const xs = ref.bloques.map((b) => b.x0), xe = ref.bloques.map((b) => b.x1), ys = ref.bloques.map((b) => b.y0);
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const mIzq = clamp(xs.length ? Math.min(...xs) : 72, 28, 100);
  const mDer = clamp(xe.length ? ref.w - Math.max(...xe) : 72, 28, 100);
  const mArr = clamp(ys.length ? Math.min(...ys) : 72, 28, 100);
  const util = ref.w - mIzq - mDer;
  // tamaño de letra más común (el "normal" del documento)
  const conteo = new Map<number, number>();
  for (const p of paginas) for (const b of p.bloques) if (b.tipo === "t") for (const l of b.lineas) for (const c of l.corridas) {
    const k = Math.round(c.tam); conteo.set(k, (conteo.get(k) || 0) + c.t.length);
  }
  const normal = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 11;

  paginas.forEach((pg, n) => {
    if (n > 0) cuerpo.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    const bloques = [...pg.bloques].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    let finAnterior = mArr;
    for (const b of bloques) {
      const antes = clamp(b.y0 - finAnterior, 0, 48);
      if (b.tipo === "i") {
        const id = imagenes.length + 1;
        imagenes.push({ nombre: `imagen${id}.png`, datos: b.png });
        let w = b.x1 - b.x0, h = b.y1 - b.y0;
        if (w > util) { h = (h * util) / w; w = util; }
        const jc = Math.abs((b.x0 + b.x1) / 2 - pg.w / 2) < pg.w * 0.06 ? `<w:jc w:val="center"/>` : "";
        const sangria = jc ? "" : `<w:ind w:left="${tw(clamp(b.x0 - mIzq, 0, util - w))}"/>`;
        cuerpo.push(`<w:p><w:pPr><w:spacing w:before="${tw(antes)}" w:after="0"/>${sangria}${jc}</w:pPr><w:r><w:drawing>` +
          `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emu(w)}" cy="${emu(h)}"/><wp:docPr id="${id}" name="Imagen ${id}"/>` +
          `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
          `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="imagen${id}.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
          `<pic:blipFill><a:blip r:embed="rImg${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
          `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
          `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
        finAnterior = b.y1;
        continue;
      }
      // un bloque de texto puede tener varios párrafos: se corta cuando hay un espacio grande,
      // una viñeta o una línea que empieza más adentro (sangría de primera línea)
      const parrafos: Linea[][] = [];
      let actual: Linea[] = [];
      b.lineas.forEach((l, i) => {
        const ant = b.lineas[i - 1];
        const alto = l.y1 - l.y0;
        const texto = l.corridas.map((c) => c.t).join("");
        const cambioTam = ant && Math.abs(tamDe(l) - tamDe(ant)) > Math.max(tamDe(l), tamDe(ant)) * 0.18; // título y texto en el mismo bloque
        const corte = ant && (l.y0 - ant.y1 > alto * 0.7 || VINETA.test(texto) || cambioTam || l.x0 - b.x0 > 14 && ant.x0 - b.x0 < 4);
        if (corte && actual.length) { parrafos.push(actual); actual = []; }
        actual.push(l);
      });
      if (actual.length) parrafos.push(actual);
      parrafos.forEach((ls, k) => {
        const x0 = Math.min(...ls.map((l) => l.x0)), x1 = Math.max(...ls.map((l) => l.x1));
        const centro = (x0 + x1) / 2;
        const ancho = x1 - x0;
        let jc = "";
        if (ancho < util * 0.85 && Math.abs(centro - (mIzq + util / 2)) < 12 && x0 - mIzq > 20) jc = "center";
        else if (ancho < util * 0.7 && Math.abs(pg.w - mDer - x1) < 8 && x0 - mIzq > util * 0.3) jc = "right";
        const sangria = jc ? 0 : clamp(x0 - mIzq, 0, util * 0.8);
        const primera = jc ? 0 : clamp(ls[0].x0 - x0, 0, 72);
        const corridas: Corrida[] = [];
        ls.forEach((l, j) => {
          const cs = l.corridas.map((c) => ({ ...c }));
          if (j < ls.length - 1 && cs.length) {
            const u = cs[cs.length - 1];
            // une las líneas: con guion de corte se pega, si no va un espacio
            if (/[-‐]$/.test(u.t) && /\p{Ll}$/u.test(u.t.slice(0, -1))) u.t = u.t.slice(0, -1);
            else if (!/\s$/.test(u.t)) u.t += " ";
          }
          corridas.push(...cs);
        });
        const grande = Math.max(...corridas.map((c) => c.tam));
        const despues = k < parrafos.length - 1 ? clamp(parrafos[k + 1][0].y0 - ls[ls.length - 1].y1, 0, 24) : 0;
        const titulo = grande >= normal * 1.35 && corridas.reduce((s, c) => s + c.t.length, 0) < 160;
        const pPr = `<w:pPr>${titulo ? `<w:keepNext/>` : ""}<w:spacing w:before="${tw(k === 0 ? antes : 0)}" w:after="${tw(despues)}"/>` +
          (sangria || primera ? `<w:ind w:left="${tw(sangria)}"${primera ? ` w:firstLine="${tw(primera)}"` : ""}/>` : "") +
          (jc ? `<w:jc w:val="${jc}"/>` : "") + `</w:pPr>`;
        cuerpo.push(`<w:p>${pPr}${compactar(corridas).filter((c) => c.t).map(corridaXml).join("")}</w:p>`);
      });
      finAnterior = b.y1;
    }
  });
  if (!cuerpo.length) cuerpo.push("<w:p/>");

  const sect = `<w:sectPr><w:pgSz w:w="${tw(ref.w)}" w:h="${tw(ref.h)}"${ref.w > ref.h ? ` w:orient="landscape"` : ""}/>` +
    `<w:pgMar w:top="${tw(mArr)}" w:right="${tw(mDer)}" w:bottom="${tw(mArr)}" w:left="${tw(mIzq)}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${cuerpo.join("")}${sect}</w:body></w:document>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="${normal * 2}"/><w:lang w:val="es-AR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rEst" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${imagenes.map((im, i) => `<Relationship Id="rImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.nombre}"/>`).join("")}</Relationships>`;
  const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const raiz = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const u = (s: string) => new TextEncoder().encode(s);
  return zip([
    { nombre: "[Content_Types].xml", datos: u(tipos) },
    { nombre: "_rels/.rels", datos: u(raiz) },
    { nombre: "word/document.xml", datos: u(documento) },
    { nombre: "word/styles.xml", datos: u(estilos) },
    { nombre: "word/_rels/document.xml.rels", datos: u(rels) },
    ...imagenes.map((im) => ({ nombre: `word/media/${im.nombre}`, datos: im.datos })),
  ]);
}

// ---------------------------------------------------------------- .zip mínimo (sin comprimir)
let TABLA: Uint32Array | null = null;
function crc32(d: Uint8Array) {
  if (!TABLA) {
    TABLA = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABLA[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABLA[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function zip(archivos: { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const partes: Uint8Array[] = [], central: Uint8Array[] = [];
  let pos = 0;
  for (const f of archivos) {
    const nombre = new TextEncoder().encode(f.nombre);
    const crc = crc32(f.datos), n = f.datos.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, n, true); local.setUint32(22, n, true); local.setUint16(26, nombre.length, true);
    const cab = new DataView(new ArrayBuffer(46));
    cab.setUint32(0, 0x02014b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 20, true); cab.setUint16(8, 0x0800, true);
    cab.setUint32(16, crc, true); cab.setUint32(20, n, true); cab.setUint32(24, n, true); cab.setUint16(28, nombre.length, true); cab.setUint32(42, pos, true);
    partes.push(new Uint8Array(local.buffer), nombre, f.datos);
    central.push(new Uint8Array(cab.buffer), nombre);
    pos += 30 + nombre.length + n;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, pos, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(todo.reduce((s, x) => s + x.length, 0));
  let o = 0; for (const x of todo) { out.set(x, o); o += x.length; }
  return out;
}
