// Reacomoda cada página dentro de una hoja de tamaño fijo (A4 o Carta), sin perder calidad:
// el contenido original se reutiliza tal cual (como un "sello" vectorial) y solo se escala y centra.

export const TAMANOS = { a4: [595.28, 841.89], carta: [612, 792] };

function caja(obj, clave) {
  const v = obj.getInheritable(clave);
  if (!v || !v.isArray() || v.length < 4) return null;
  const n = [0, 1, 2, 3].map((i) => v.get(i).asNumber());
  return [Math.min(n[0], n[2]), Math.min(n[1], n[3]), Math.max(n[0], n[2]), Math.max(n[1], n[3])];
}

function contenido(pagina) {
  const c = pagina.get("Contents");
  const partes = [];
  if (!c || c.isNull?.()) return new Uint8Array();
  const leer = (s) => partes.push(s.readStream().asUint8Array().slice());
  if (c.isArray()) for (let i = 0; i < c.length; i++) leer(c.get(i));
  else if (c.isStream()) leer(c);
  const total = partes.reduce((n, p) => n + p.length + 1, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; out[o++] = 10; }
  return out;
}

// opciones: { tamano: "a4" | "carta", margen: puntos, orientacion: "auto" | "vertical" }
export function ajustarPaginas(mupdf, doc, opciones) {
  // tamano "original": cada página conserva su tamaño (solo se agregan márgenes o se endereza)
  const original = opciones.tamano === "original";
  const [A, B] = TAMANOS[opciones.tamano] || TAMANOS.a4;
  const m = Math.max(0, Math.min(opciones.margen || 0, 5 * 28.3465));
  // las anotaciones se fijan al contenido para que no se pierdan al rearmar las páginas
  doc.bake(true, true);
  const n = doc.countPages();
  let cambiadas = 0;
  for (let i = 0; i < n; i++) {
    const obj = doc.findPage(i);
    const mb = caja(obj, "MediaBox") || [0, 0, A, B];
    const cb = caja(obj, "CropBox") || mb;
    const x0 = Math.max(cb[0], mb[0]), y0 = Math.max(cb[1], mb[1]);
    const x1 = Math.min(cb[2], mb[2]), y1 = Math.min(cb[3], mb[3]);
    const rotObj = obj.getInheritable("Rotate");
    let r = (((rotObj && rotObj.isNumber() ? rotObj.asNumber() : 0) % 360) + 360) % 360;
    const w = x1 - x0, h = y1 - y0;
    let dw = r === 90 || r === 270 ? h : w;
    let dh = r === 90 || r === 270 ? w : h;
    let girada = false;
    if (original && opciones.orientacion === "vertical" && dw > dh * 1.02) {
      // sin cambiar el tamaño: la página acostada se gira para quedar parada (sin perder calidad)
      r = (r + 90) % 360;
      obj.put("Rotate", r);
      [dw, dh] = [dh, dw];
      girada = true;
    }
    if (original && m === 0) { if (girada) cambiadas++; continue; }
    const apaisada = opciones.orientacion !== "vertical" && dw > dh * 1.02;
    const W = original ? dw + 2 * m : apaisada ? B : A;
    const H = original ? dh + 2 * m : apaisada ? A : B;
    // ya tiene el tamaño buscado y no hay que agregar margen: se deja igual
    if (!original && m === 0 && r === 0 && Math.abs(dw - W) < 1.5 && Math.abs(dh - H) < 1.5) continue;
    const s = Math.min((W - 2 * m) / dw, (H - 2 * m) / dh);
    const tx = (W - dw * s) / 2, ty = (H - dh * s) / 2;
    let mat;
    if (r === 90) mat = [0, -s, s, 0, tx - s * y0, ty + s * x1];
    else if (r === 180) mat = [-s, 0, 0, -s, tx + s * x1, ty + s * y1];
    else if (r === 270) mat = [0, s, -s, 0, tx + s * y1, ty - s * x0];
    else mat = [s, 0, 0, s, tx - s * x0, ty - s * y0];

    const recursos = obj.getInheritable("Resources");
    const forma = doc.addStream(contenido(obj), {
      Type: doc.newName("XObject"),
      Subtype: doc.newName("Form"),
      BBox: [x0, y0, x1, y1],
      Resources: recursos && !recursos.isNull() ? recursos : doc.newDictionary(),
    });
    const f = (v) => (Math.abs(v) < 1e-6 ? "0" : v.toFixed(4));
    const cmd = `q ${mat.map(f).join(" ")} cm /OzPag Do Q`;
    const nueva = doc.addPage([0, 0, W, H], 0, { XObject: { OzPag: forma } }, cmd);
    doc.insertPage(i, nueva);
    doc.deletePage(i + 1);
    cambiadas++;
  }
  return cambiadas;
}

// Arma páginas a partir de fotos (escaneos), cada una centrada en su hoja.
export function agregarImagenes(mupdf, doc, imagenes, opciones) {
  const [A, B] = TAMANOS[opciones.tamano] || TAMANOS.a4;
  const m = opciones.margen || 0;
  for (const datos of imagenes) {
    const img = new mupdf.Image(datos);
    const iw = img.getWidth(), ih = img.getHeight();
    const apaisada = iw > ih * 1.02;
    const W = apaisada ? B : A, H = apaisada ? A : B;
    const s = Math.min((W - 2 * m) / iw, (H - 2 * m) / ih);
    const w = iw * s, h = ih * s, x = (W - w) / 2, y = (H - h) / 2;
    const ref = doc.addImage(img);
    const pag = doc.addPage([0, 0, W, H], 0, { XObject: { OzImg: ref } }, `q ${w.toFixed(3)} 0 0 ${h.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /OzImg Do Q`);
    doc.insertPage(-1, pag);
    img.destroy();
  }
}
