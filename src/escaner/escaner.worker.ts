// Procesamiento de fotos para el escáner: detectar la hoja, enderezarla y aplicar el filtro.
// Todo corre en el equipo; no se usa ningún servicio externo.

type Punto = [number, number];
export type Filtro = "original" | "mejorado" | "grises" | "bn";

type Img = { w: number; h: number; d: Uint8ClampedArray };

// ---------- detección de la hoja ----------
// Se trabaja en una copia chica: se separa la hoja (clara) del fondo con un umbral automático,
// se toma la mancha clara más grande y se buscan sus cuatro esquinas.
function detectar(img: Img): Punto[] {
  const k = Math.min(1, 360 / Math.max(img.w, img.h));
  const w = Math.max(8, Math.round(img.w * k)), h = Math.max(8, Math.round(img.h * k));
  const gris = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.w - 1, Math.floor(x / k)), sy = Math.min(img.h - 1, Math.floor(y / k));
      const i = (sy * img.w + sx) * 4;
      gris[y * w + x] = 0.299 * img.d[i] + 0.587 * img.d[i + 1] + 0.114 * img.d[i + 2];
    }
  const suave = desenfocar(gris, w, h, 3);
  // umbral de Otsu
  const hist = new Array(256).fill(0);
  for (const v of suave) hist[Math.max(0, Math.min(255, v | 0))]++;
  const total = w * h;
  let suma = 0;
  for (let i = 0; i < 256; i++) suma += i * hist[i];
  let sB = 0, wB = 0, mejor = 0, umbral = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (suma - sB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > mejor) { mejor = v; umbral = t; }
  }
  // mancha clara más grande
  const marca = new Int32Array(w * h).fill(-1);
  let mejorId = -1, mejorN = 0;
  const pila: number[] = [];
  for (let i = 0, id = 0; i < total; i++) {
    if (marca[i] !== -1 || suave[i] <= umbral) continue;
    let n = 0;
    pila.push(i); marca[i] = id;
    while (pila.length) {
      const p = pila.pop()!; n++;
      const x = p % w, y = (p / w) | 0;
      const vec = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of vec) if (q >= 0 && marca[q] === -1 && suave[q] > umbral) { marca[q] = id; pila.push(q); }
    }
    if (n > mejorN) { mejorN = n; mejorId = id; }
    id++;
  }
  const area = mejorN / total;
  const porDefecto: Punto[] = [[img.w * 0.04, img.h * 0.04], [img.w * 0.96, img.h * 0.04], [img.w * 0.96, img.h * 0.96], [img.w * 0.04, img.h * 0.96]];
  if (mejorId < 0 || area < 0.12 || area > 0.985) return porDefecto;
  let tl = [0, 0], tr = [0, 0], br = [0, 0], bl = [0, 0];
  let vTl = Infinity, vTr = -Infinity, vBr = -Infinity, vBl = Infinity;
  for (let i = 0; i < total; i++) {
    if (marca[i] !== mejorId) continue;
    const x = i % w, y = (i / w) | 0;
    if (x + y < vTl) { vTl = x + y; tl = [x, y]; }
    if (x + y > vBr) { vBr = x + y; br = [x, y]; }
    if (x - y > vTr) { vTr = x - y; tr = [x, y]; }
    if (x - y < vBl) { vBl = x - y; bl = [x, y]; }
  }
  const esq = [tl, tr, br, bl].map(([x, y]) => [Math.min(img.w, (x + 0.5) / k), Math.min(img.h, (y + 0.5) / k)] as Punto);
  // el cuadrilátero tiene que ocupar una parte razonable de la foto
  const a = Math.abs(areaPoligono(esq)) / (img.w * img.h);
  return a < 0.12 ? porDefecto : esq;
}

function areaPoligono(p: Punto[]) {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; }
  return s / 2;
}

// desenfoque de caja separable (radio r), rápido con sumas acumuladas
function desenfocar(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0; const fila = y * w;
    for (let x = -r; x <= r; x++) acc += src[fila + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[fila + x] = acc / (2 * r + 1);
      acc += src[fila + Math.min(w - 1, x + r + 1)] - src[fila + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

// ---------- enderezar (corrección de perspectiva) ----------
function homografia(de: Punto[], a: Punto[]) {
  // resuelve H tal que a = H · de (8 incógnitas)
  const M: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = de[i], [u, v] = a[i];
    M.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    M.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k < 9; k++) M[r][k] -= f * M[c][k];
    }
  }
  const h = M.map((f, i) => f[8] / f[i]);
  return [...h, 1];
}

function enderezar(img: Img, esq: Punto[], maximo: number): Img {
  const d = (a: Punto, b: Punto) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let W = Math.max(d(esq[0], esq[1]), d(esq[3], esq[2]));
  let H = Math.max(d(esq[0], esq[3]), d(esq[1], esq[2]));
  const k = Math.min(1, maximo / Math.max(W, H));
  W = Math.max(16, Math.round(W * k)); H = Math.max(16, Math.round(H * k));
  // H lleva cada punto de la salida a la foto original
  const m = homografia([[0, 0], [W, 0], [W, H], [0, H]], esq);
  const out = new Uint8ClampedArray(W * H * 4);
  const sw = img.w, sh = img.h, s = img.d;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const z = m[6] * x + m[7] * y + m[8];
      const fx = (m[0] * x + m[1] * y + m[2]) / z, fy = (m[3] * x + m[4] * y + m[5]) / z;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const ax = fx - x0, ay = fy - y0;
      const xa = Math.min(sw - 1, Math.max(0, x0)), xb = Math.min(sw - 1, Math.max(0, x0 + 1));
      const ya = Math.min(sh - 1, Math.max(0, y0)), yb = Math.min(sh - 1, Math.max(0, y0 + 1));
      const i00 = (ya * sw + xa) * 4, i10 = (ya * sw + xb) * 4, i01 = (yb * sw + xa) * 4, i11 = (yb * sw + xb) * 4;
      const o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = s[i00 + c] * (1 - ax) + s[i10 + c] * ax;
        const bot = s[i01 + c] * (1 - ax) + s[i11 + c] * ax;
        out[o + c] = top * (1 - ay) + bot * ay;
      }
      out[o + 3] = 255;
    }
  }
  return { w: W, h: H, d: out };
}

// ---------- filtros ----------
// Estima la luz del papel (fondo) para sacar sombras: se achica la imagen, se toma el máximo
// local (el papel es lo más claro) y se suaviza. Dividir por ese fondo deja el papel blanco parejo.
function fondoDePapel(img: Img) {
  const { w, h, d } = img;
  const p = 8;
  const sw = Math.ceil(w / p), sh = Math.ceil(h / p);
  const chico = new Float32Array(sw * sh);
  for (let by = 0; by < sh; by++)
    for (let bx = 0; bx < sw; bx++) {
      let mx = 0;
      for (let y = by * p; y < Math.min(h, by * p + p); y += 2)
        for (let x = bx * p; x < Math.min(w, bx * p + p); x += 2) {
          const i = (y * w + x) * 4;
          const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          if (l > mx) mx = l;
        }
      chico[by * sw + bx] = mx;
    }
  // máximo en vecindad (borra letras) y luego suavizado
  const dil = new Float32Array(sw * sh);
  const r = 3;
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      let mx = 0;
      for (let yy = Math.max(0, y - r); yy <= Math.min(sh - 1, y + r); yy++)
        for (let xx = Math.max(0, x - r); xx <= Math.min(sw - 1, x + r); xx++) mx = Math.max(mx, chico[yy * sw + xx]);
      dil[y * sw + x] = mx;
    }
  const suave = desenfocar(dil, sw, sh, 3);
  // Nivel típico del papel (percentil 90). Una zona mucho más oscura que eso no es papel en sombra
  // sino contenido (una foto, una tabla con fondo): no se la aclara como si fuera papel, así no se quema.
  const orden = Array.from(suave).sort((a, b) => a - b);
  const papel = Math.max(60, orden[Math.floor(orden.length * 0.9)] || 200);
  const piso = papel * 0.62;
  return (x: number, y: number) => {
    const fx = Math.min(sw - 1.001, Math.max(0, x / p - 0.5)), fy = Math.min(sh - 1.001, Math.max(0, y / p - 0.5));
    const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
    const a = suave[y0 * sw + x0], b = suave[y0 * sw + x0 + 1], c = suave[(y0 + 1) * sw + x0], e = suave[(y0 + 1) * sw + x0 + 1];
    return Math.max(piso, (a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + e * ax) * ay);
  };
}

// Color del papel: se promedian los píxeles que son papel (casi tan claros como el fondo estimado)
// y se calcula cuánto corregir cada canal para que el papel quede blanco y no amarillento o azulado.
function balanceDeBlancos(img: Img, fondo: (x: number, y: number) => number): [number, number, number] {
  const { w, h, d } = img;
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = 0; y < h; y += 6)
    for (let x = 0; x < w; x += 6) {
      const i = (y * w + x) * 4;
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (l < fondo(x, y) * 0.9) continue;
      sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++;
    }
  if (n < 50) return [1, 1, 1];
  const r = sr / n, g = sg / n, b = sb / n, l = 0.299 * r + 0.587 * g + 0.114 * b;
  const k = (v: number) => Math.min(1.3, Math.max(0.77, l / Math.max(1, v)));
  return [k(r), k(g), k(b)];
}

function filtrar(img: Img, filtro: Filtro): Img {
  if (filtro === "original") return img;
  const { w, h, d } = img;
  const out = new Uint8ClampedArray(d.length);
  const fondo = fondoDePapel(img);
  const [kr, kg, kb] = balanceDeBlancos(img, fondo);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const f = 250 / fondo(x, y);
      if (filtro === "mejorado") {
        // papel blanco y parejo, colores un poco más vivos, sin quemar lo claro
        let r = d[i] * kr * f, g = d[i + 1] * kg * f, b = d[i + 2] * kb * f;
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * 1.15; g = l + (g - l) * 1.15; b = l + (b - l) * 1.15;
        out[i] = curva(r); out[i + 1] = curva(g); out[i + 2] = curva(b);
      } else {
        const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * f;
        const v = filtro === "grises" ? curva(l) : l > 175 ? 255 : l < 120 ? 0 : (l - 120) * 4.6;
        out[i] = out[i + 1] = out[i + 2] = v;
      }
      out[i + 3] = 255;
    }
  return { w, h, d: out };
}

// realza el contraste: lo casi blanco pasa a blanco y los oscuros se profundizan
function curva(v: number) {
  const t = Math.min(1, Math.max(0, (v - 14) / (247 - 14)));
  return 255 * (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)) * 0.25 + 255 * t * 0.75;
}

function rotar90(img: Img): Img {
  const { w, h, d } = img;
  const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = (x * h + (h - 1 - y)) * 4;
      out[o] = d[i]; out[o + 1] = d[i + 1]; out[o + 2] = d[i + 2]; out[o + 3] = d[i + 3];
    }
  return { w: h, h: w, d: out };
}

self.onmessage = (e: MessageEvent) => {
  const { id, op, args } = e.data;
  try {
    let r: any;
    if (op === "detectar") r = detectar(args.img);
    else if (op === "procesar") {
      let img = enderezar(args.img, args.esquinas, args.maximo || 2200);
      for (let i = 0; i < ((args.giro || 0) / 90) % 4; i++) img = rotar90(img);
      img = filtrar(img, args.filtro);
      r = img;
    }
    const tr = r && r.d ? [r.d.buffer] : [];
    (self as unknown as Worker).postMessage({ id, ok: true, r }, tr);
  } catch (err: any) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
