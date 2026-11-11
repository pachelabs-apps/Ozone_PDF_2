import { useEffect, useRef, useState } from "react";
import { T, idioma } from "../i18n";

export type Firma = { png: Uint8Array; url: string; aspecto: number };

const CLAVE = "ozone.firma";
// Lo que va debajo del dibujo, como en un sello: aclaración, cargo o área, matrícula, fecha.
type Datos = { aclaracion: string; cargo: string; otro: string; fecha: boolean };
const SIN_DATOS: Datos = { aclaracion: "", cargo: "", otro: "", fecha: false };
function leerDatos(): Datos {
  try { return { ...SIN_DATOS, ...JSON.parse(localStorage.getItem(CLAVE + ".datos") || "{}") }; } catch { return SIN_DATOS; }
}
const hayDatos = (d: Datos) => !!(d.aclaracion.trim() || d.cargo.trim() || d.otro.trim() || d.fecha);

// Arma la imagen final: el dibujo arriba, una línea fina y los datos centrados debajo.
async function componer(dibujo: HTMLCanvasElement, d: Datos): Promise<HTMLCanvasElement> {
  const lineas: { t: string; negrita: boolean }[] = [];
  if (d.aclaracion.trim()) lineas.push({ t: d.aclaracion.trim(), negrita: true });
  if (d.cargo.trim()) lineas.push({ t: d.cargo.trim(), negrita: false });
  if (d.otro.trim()) lineas.push({ t: d.otro.trim(), negrita: false });
  if (d.fecha) lineas.push({ t: new Date().toLocaleDateString(idioma() === "en" ? "en-US" : idioma()), negrita: false });
  if (!lineas.length) return dibujo;
  const w0 = dibujo.width, h0 = dibujo.height;
  const fs = Math.round(Math.min(46, Math.max(22, w0 * 0.075)));
  const fuente = (n: boolean) => `${n ? 700 : 400} ${fs}px Atkinson, system-ui, sans-serif`;
  try { await Promise.all([document.fonts.load(fuente(true)), document.fonts.load(fuente(false))]); } catch { /* sigue con la de sistema */ }
  const medir = document.createElement("canvas").getContext("2d")!;
  const anchos = lineas.map((l) => { medir.font = fuente(l.negrita); return medir.measureText(l.t).width; });
  const pad = Math.round(fs * 0.5);
  const anchoTexto = Math.max(...anchos);
  const W = Math.ceil(Math.max(w0, anchoTexto + pad * 2));
  const altoLinea = Math.round(fs * 1.3);
  const yLinea = h0 + Math.round(fs * 0.25);
  const H = yLinea + Math.round(fs * 0.55) + altoLinea * lineas.length + Math.round(fs * 0.2);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(dibujo, Math.round((W - w0) / 2), 0);
  const largo = Math.min(W, Math.max(anchoTexto + pad, w0 * 0.8));
  ctx.strokeStyle = "#555"; ctx.lineWidth = Math.max(1.5, fs / 16);
  ctx.beginPath(); ctx.moveTo((W - largo) / 2, yLinea); ctx.lineTo((W + largo) / 2, yLinea); ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  lineas.forEach((l, i) => {
    ctx.font = fuente(l.negrita);
    ctx.fillStyle = l.negrita ? "#141414" : "#3a3a3a";
    ctx.fillText(l.t, W / 2, yLinea + Math.round(fs * 0.55) + altoLinea * i + fs);
  });
  return c;
}

export function firmaGuardada(): Firma | null {
  try {
    const url = localStorage.getItem(CLAVE);
    const aspecto = Number(localStorage.getItem(CLAVE + ".aspecto") || "3");
    if (!url) return null;
    return { url, aspecto, png: dataUrlABytes(url) };
  } catch {
    return null;
  }
}

function dataUrlABytes(url: string) {
  const b = atob(url.split(",")[1]);
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}

// Recorta los bordes vacíos para que la firma quede justa.
function recortar(c: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = c.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const m = 6;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
  x1 = Math.min(width - 1, x1 + m); y1 = Math.min(height - 1, y1 + m);
  const o = document.createElement("canvas");
  o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext("2d")!.drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}

export default function FirmaModal(p: { alCerrar: (f: Firma | null) => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [hayTrazo, setHayTrazo] = useState(false);
  const [recordar, setRecordar] = useState(true);
  const [datos, setDatos] = useState<Datos>(leerDatos);
  const [conDatos, setConDatos] = useState(() => hayDatos(leerDatos()));
  const ultimo = useRef<[number, number] | null>(null);
  const tinta = getComputedStyle(document.documentElement).getPropertyValue("--tinta-firma").trim() || "#13235B";

  useEffect(() => {
    const c = lienzo.current!;
    const dpr = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = tinta; ctx.lineWidth = 2.8;
    // si ya hay una firma guardada, aparece cargada: se le pueden cambiar los datos sin volver a dibujarla
    let cruda: string | null = null;
    try { cruda = localStorage.getItem(CLAVE + ".cruda"); } catch { /* nada */ }
    if (cruda) {
      const img = new Image();
      img.onload = () => {
        const k = Math.min((r.width * 0.9) / img.width, (r.height * 0.85) / img.height);
        const w = img.width * k, h = img.height * k;
        ctx.drawImage(img, (r.width - w) / 2, (r.height - h) / 2, w, h);
        setHayTrazo(true);
      };
      img.src = cruda;
    }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && p.alCerrar(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function punto(e: React.PointerEvent): [number, number] {
    const r = lienzo.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function limpiar() {
    const c = lienzo.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHayTrazo(false);
  }

  async function terminar(dibujo: HTMLCanvasElement) {
    const d = conDatos ? datos : SIN_DATOS;
    const c = await componer(dibujo, d);
    const url = c.toDataURL("image/png");
    const f: Firma = { url, png: dataUrlABytes(url), aspecto: c.width / c.height };
    try {
      if (recordar) {
        localStorage.setItem(CLAVE, f.url);
        localStorage.setItem(CLAVE + ".aspecto", String(f.aspecto));
        localStorage.setItem(CLAVE + ".cruda", dibujo.toDataURL("image/png"));
        localStorage.setItem(CLAVE + ".datos", JSON.stringify(d));
      } else {
        for (const k of ["", ".aspecto", ".cruda", ".datos"]) localStorage.removeItem(CLAVE + k);
      }
    } catch { /* sin almacenamiento */ }
    p.alCerrar(f);
  }
  async function usar() {
    const c = recortar(lienzo.current!);
    if (c) await terminar(c);
  }

  function subir() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const lector = new FileReader();
      lector.onload = () => {
        const img = new Image();
        img.onload = () => {
          // se pasa por un lienzo para guardarla como PNG y sin datos ocultos de la foto
          const c = document.createElement("canvas");
          const max = 1200;
          const k = Math.min(1, max / Math.max(img.width, img.height));
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
          terminar(c);
        };
        img.src = String(lector.result);
      };
      lector.readAsDataURL(f);
    };
    input.click();
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-firma" onPointerDown={(e) => e.target === e.currentTarget && p.alCerrar(null)}>
      <div className="modal__caja modal__caja--firma">
        <h2 id="titulo-firma">{T("Tu firma")}</h2>
        <p className="modal__ayuda">{T("Firmá con el mouse o con el dedo.")}</p>
        <canvas
          ref={lienzo}
          className="firma__lienzo"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            ultimo.current = punto(e);
            const ctx = lienzo.current!.getContext("2d")!;
            ctx.beginPath(); ctx.arc(ultimo.current[0], ultimo.current[1], 1.3, 0, Math.PI * 2);
            ctx.fillStyle = tinta; ctx.fill();
            setHayTrazo(true);
          }}
          onPointerMove={(e) => {
            if (!ultimo.current) return;
            const ctx = lienzo.current!.getContext("2d")!;
            const eventos = (e.nativeEvent.getCoalescedEvents?.() || [e.nativeEvent]) as PointerEvent[];
            for (const ev of eventos) {
              const r = lienzo.current!.getBoundingClientRect();
              const pt: [number, number] = [ev.clientX - r.left, ev.clientY - r.top];
              const [ux, uy] = ultimo.current!;
              ctx.beginPath(); ctx.moveTo(ux, uy);
              ctx.quadraticCurveTo(ux, uy, (ux + pt[0]) / 2, (uy + pt[1]) / 2);
              ctx.lineTo(pt[0], pt[1]); ctx.stroke();
              ultimo.current = pt;
            }
          }}
          onPointerUp={() => (ultimo.current = null)}
          onPointerCancel={() => (ultimo.current = null)}
        />
        {conDatos ? (
          <div className="firma__datos">
            <p className="modal__ayuda">{T("Van debajo de la firma, como en un sello. Todos son opcionales.")}</p>
            <input className="campo" value={datos.aclaracion} onChange={(e) => setDatos({ ...datos, aclaracion: e.target.value })}
              placeholder={T("Aclaración (nombre y apellido)")} aria-label={T("Aclaración (nombre y apellido)")} maxLength={80} />
            <input className="campo" value={datos.cargo} onChange={(e) => setDatos({ ...datos, cargo: e.target.value })}
              placeholder={T("Cargo o área (opcional)")} aria-label={T("Cargo o área (opcional)")} maxLength={90} />
            <input className="campo" value={datos.otro} onChange={(e) => setDatos({ ...datos, otro: e.target.value })}
              placeholder={T("Matrícula, DNI o legajo (opcional)")} aria-label={T("Matrícula, DNI o legajo (opcional)")} maxLength={60} />
            <label className="firma__recordar firma__fecha">
              <input type="checkbox" checked={datos.fecha} onChange={(e) => setDatos({ ...datos, fecha: e.target.checked })} />
              {T("Agregar la fecha de hoy")}
            </label>
            <button type="button" className="firma__quitar" onClick={() => setConDatos(false)}>{T("Quitar aclaración")}</button>
          </div>
        ) : (
          <button type="button" className="firma__agregar" onClick={() => setConDatos(true)}>+ {T("Agregar aclaración, cargo o matrícula")}</button>
        )}
        <label className="firma__recordar">
          <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
          {T("Recordar en este equipo")}
        </label>
        <div className="modal__botones">
          <button className="boton boton--suave" onClick={limpiar} disabled={!hayTrazo}>{T("Limpiar")}</button>
          <button className="boton boton--suave" onClick={subir}>{T("Subir imagen")}</button>
          <span className="espacio" />
          <button className="boton boton--suave" onClick={() => p.alCerrar(null)}>{T("Cancelar")}</button>
          <button className="boton boton--primario" onClick={usar} disabled={!hayTrazo}>{T("Usar firma")}</button>
        </div>
      </div>
    </div>
  );
}
