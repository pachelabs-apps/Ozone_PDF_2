import { useEffect, useRef, useState } from "react";
import { T } from "../i18n";

export type Firma = { png: Uint8Array; url: string; aspecto: number };

const CLAVE = "ozone.firma";

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

  async function usar() {
    const c = recortar(lienzo.current!);
    if (!c) return;
    const url = c.toDataURL("image/png");
    const f: Firma = { url, png: dataUrlABytes(url), aspecto: c.width / c.height };
    guardar(f);
    p.alCerrar(f);
  }

  function guardar(f: Firma) {
    try {
      if (recordar) {
        localStorage.setItem(CLAVE, f.url);
        localStorage.setItem(CLAVE + ".aspecto", String(f.aspecto));
      } else {
        localStorage.removeItem(CLAVE);
      }
    } catch { /* sin almacenamiento */ }
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
          const url = c.toDataURL("image/png");
          const firma: Firma = { url, png: dataUrlABytes(url), aspecto: c.width / c.height };
          guardar(firma);
          p.alCerrar(firma);
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
