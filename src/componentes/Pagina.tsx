import { useEffect, useRef, useState } from "react";
import { motor, type Anotacion, type InfoPagina, type Punto, type Rect } from "../motor/motor";

export type Herramienta =
  | "seleccionar" | "resaltar" | "subrayar" | "tachar" | "texto" | "recuadro" | "dibujar" | "firma" | "censurar";

export type Seleccion = { pagina: number; id: number } | null;

type Props = {
  indice: number;
  info: InfoPagina;
  zoom: number;
  version: number;
  herramienta: Herramienta;
  anotaciones: Anotacion[];
  seleccion: Seleccion;
  textoAbierto: { x: number; y: number; inicial?: string; tam?: number; color?: string } | null;
  tamTexto: number;
  colorCss: string;
  alVer: (i: number, visible: boolean) => void;
  alSoltar: (accion: Accion) => void;
  alSeleccionar: (s: Seleccion) => void;
  alTerminarTexto: (texto: string | null) => void;
  alEditarTexto: (a: Anotacion) => void; // tocar un texto ya puesto lo abre para cambiarlo
};

export type Accion =
  | { tipo: "resaltar"; a: Punto; b: Punto }
  | { tipo: "texto"; x: number; y: number }
  | { tipo: "recuadro" | "censurar"; r: Rect }
  | { tipo: "dibujar"; trazo: Punto[] }
  | { tipo: "firma"; x: number; y: number }
  | { tipo: "mover"; id: number; dx: number; dy: number }
  | { tipo: "ajustar"; id: number; r: Rect };

type Arrastre =
  | { modo: "caja"; a: Punto; b: Punto }
  | { modo: "trazo"; puntos: Punto[] }
  | { modo: "mover"; id: number; a: Punto; b: Punto; editar?: boolean }
  | { modo: "ajustar"; id: number; r0: Rect; a: Punto; b: Punto };

const LIENZO_MAX = 4096 * 4096; // límite de píxeles por página para no agotar la memoria

export default function Pagina(p: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [cargando, setCargando] = useState(true);
  const W = p.info.w * p.zoom, H = p.info.h * p.zoom;

  // Saber si la página está a la vista para dibujarla solo cuando hace falta.
  useEffect(() => {
    const el = caja.current!;
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      p.alVer(p.indice, e.isIntersecting);
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dibujar la página (con un pequeño retraso al hacer zoom, para no recalcular de más).
  useEffect(() => {
    if (!visible) return;
    let cancelado = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let escala = p.zoom * dpr;
    const px = p.info.w * escala * p.info.h * escala;
    if (px > LIENZO_MAX) escala *= Math.sqrt(LIENZO_MAX / px);
    const t = setTimeout(async () => {
      try {
        const { w, h, pixeles } = await motor.render(p.indice, escala);
        if (cancelado || !lienzo.current) return;
        const c = lienzo.current;
        c.width = w; c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        const bmp = await createImageBitmap(new ImageData(pixeles as Uint8ClampedArray<ArrayBuffer>, w, h));
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        setCargando(false);
      } catch { /* página que no se pudo dibujar: queda en blanco */ }
    }, 90);
    return () => { cancelado = true; clearTimeout(t); };
  }, [visible, p.zoom, p.version, p.indice, p.info.w, p.info.h]);

  function aPunto(e: { clientX: number; clientY: number }): Punto {
    const r = caja.current!.getBoundingClientRect();
    return [p.info.x0 + (e.clientX - r.left) / p.zoom, p.info.y0 + (e.clientY - r.top) / p.zoom];
  }

  function aCss(r: Rect) {
    return {
      left: (r[0] - p.info.x0) * p.zoom,
      top: (r[1] - p.info.y0) * p.zoom,
      width: (r[2] - r[0]) * p.zoom,
      height: (r[3] - r[1]) * p.zoom,
    };
  }

  function tocada(pt: Punto) {
    const m = 4 / p.zoom;
    for (let i = p.anotaciones.length - 1; i >= 0; i--) {
      const a = p.anotaciones[i];
      if (pt[0] >= a.r[0] - m && pt[0] <= a.r[2] + m && pt[1] >= a.r[1] - m && pt[1] <= a.r[3] + m) return a;
    }
    return null;
  }

  const dibuja = p.herramienta !== "seleccionar";

  function abajo(e: React.PointerEvent) {
    if (e.button !== 0 || p.textoAbierto) return;
    const pt = aPunto(e);
    const h = p.herramienta;
    if (h === "seleccionar") {
      const a = tocada(pt);
      // un texto ya seleccionado: tocarlo de nuevo lo abre para editar (arrastrarlo lo mueve)
      const yaElegido = !!a && a.tipo === "FreeText" && p.seleccion?.pagina === p.indice && p.seleccion.id === a.id;
      p.alSeleccionar(a ? { pagina: p.indice, id: a.id } : null);
      if (a?.movible) {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        setArrastre({ modo: "mover", id: a.id, a: pt, b: pt, editar: yaElegido });
      }
      return;
    }
    if (h === "texto") {
      // sobre un texto ya puesto: tocarlo lo abre para editar y arrastrarlo lo mueve
      const a = tocada(pt);
      if (a && a.tipo === "FreeText") {
        e.preventDefault();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        p.alSeleccionar({ pagina: p.indice, id: a.id });
        setArrastre({ modo: "mover", id: a.id, a: pt, b: pt, editar: true });
        return;
      }
    }
    if (h === "texto" || h === "firma") {
      // se evita que el clic le saque el foco al cuadro de texto que se abre
      e.preventDefault();
      return p.alSoltar({ tipo: h, x: pt[0], y: pt[1] });
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (h === "dibujar") setArrastre({ modo: "trazo", puntos: [pt] });
    else setArrastre({ modo: "caja", a: pt, b: pt });
    e.preventDefault();
  }

  function mueve(e: React.PointerEvent) {
    if (!arrastre) return;
    const pt = aPunto(e);
    if (arrastre.modo === "trazo") {
      const u = arrastre.puntos[arrastre.puntos.length - 1];
      if (Math.hypot(pt[0] - u[0], pt[1] - u[1]) * p.zoom < 1.5) return;
      setArrastre({ ...arrastre, puntos: [...arrastre.puntos, pt] });
    } else setArrastre({ ...arrastre, b: pt });
  }

  function arriba() {
    const a = arrastre;
    setArrastre(null);
    if (!a) return;
    if (a.modo === "trazo") {
      if (a.puntos.length > 1) p.alSoltar({ tipo: "dibujar", trazo: a.puntos });
      return;
    }
    const dx = a.b[0] - a.a[0], dy = a.b[1] - a.a[1];
    if (a.modo === "mover") {
      // en pantalla: más de unos píxeles es arrastrar; menos es un toque
      const movio = (Math.abs(dx) + Math.abs(dy)) * p.zoom > (a.editar ? 6 : 0.5);
      if (movio) p.alSoltar({ tipo: "mover", id: a.id, dx, dy });
      else if (a.editar) {
        const an = p.anotaciones.find((x) => x.id === a.id);
        if (an) p.alEditarTexto(an);
      }
      return;
    }
    if (a.modo === "ajustar") {
      const r: Rect = [a.r0[0], a.r0[1], Math.max(a.r0[0] + 8, a.r0[2] + dx), Math.max(a.r0[1] + 8, a.r0[3] + dy)];
      p.alSoltar({ tipo: "ajustar", id: a.id, r });
      return;
    }
    const r: Rect = [Math.min(a.a[0], a.b[0]), Math.min(a.a[1], a.b[1]), Math.max(a.a[0], a.b[0]), Math.max(a.a[1], a.b[1])];
    const h = p.herramienta;
    if (h === "resaltar" || h === "subrayar" || h === "tachar") {
      p.alSoltar({ tipo: "resaltar", a: a.a, b: a.b });
    } else if ((h === "recuadro" || h === "censurar") && r[2] - r[0] > 3 && r[3] - r[1] > 3) {
      p.alSoltar({ tipo: h, r });
    }
  }

  const sel = p.seleccion?.pagina === p.indice ? p.anotaciones.find((a) => a.id === p.seleccion!.id) : null;
  let selR = sel?.r;
  if (sel && arrastre?.modo === "mover" && arrastre.id === sel.id) {
    const dx = arrastre.b[0] - arrastre.a[0], dy = arrastre.b[1] - arrastre.a[1];
    selR = [sel.r[0] + dx, sel.r[1] + dy, sel.r[2] + dx, sel.r[3] + dy];
  }
  if (sel && arrastre?.modo === "ajustar" && arrastre.id === sel.id) {
    const dx = arrastre.b[0] - arrastre.a[0], dy = arrastre.b[1] - arrastre.a[1];
    selR = [arrastre.r0[0], arrastre.r0[1], Math.max(arrastre.r0[0] + 8, arrastre.r0[2] + dx), Math.max(arrastre.r0[1] + 8, arrastre.r0[3] + dy)];
  }

  return (
    <div
      ref={caja}
      className={"pagina" + (cargando ? " pagina--cargando" : "")}
      style={{ width: W, height: H }}
      data-pagina={p.indice}
    >
      <canvas ref={lienzo} className="pagina__lienzo" style={{ width: W, height: H }} />
      <div
        className={"pagina__capa" + (dibuja ? " pagina__capa--dibujo" : "") + ` herr-${p.herramienta}`}
        onPointerDown={abajo}
        onPointerMove={mueve}
        onPointerUp={arriba}
        onPointerCancel={() => setArrastre(null)}
      >
        {p.anotaciones.filter((a) => a.tipo === "Redact").map((a) => (
          <div key={a.id} className="censura-pendiente" style={aCss(a.r)} />
        ))}

        {arrastre?.modo === "caja" && (() => {
          const r: Rect = [Math.min(arrastre.a[0], arrastre.b[0]), Math.min(arrastre.a[1], arrastre.b[1]),
            Math.max(arrastre.a[0], arrastre.b[0]), Math.max(arrastre.a[1], arrastre.b[1])];
          const clase = p.herramienta === "censurar" ? "previa previa--censura"
            : p.herramienta === "recuadro" ? "previa previa--recuadro" : "previa previa--texto";
          return <div className={clase} style={{ ...aCss(r), borderColor: p.colorCss }} />;
        })()}

        {arrastre?.modo === "trazo" && (
          <svg className="previa-trazo" width={W} height={H}>
            <polyline
              points={arrastre.puntos.map(([x, y]) => `${(x - p.info.x0) * p.zoom},${(y - p.info.y0) * p.zoom}`).join(" ")}
              fill="none" stroke={p.colorCss} strokeWidth={Math.max(2, 2 * p.zoom)} strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        )}

        {sel && selR && (
          <div className="seleccion" style={aCss(selR)}>
            {sel.redimensionable && (
              <span
                className="seleccion__tirador"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.currentTarget.parentElement!.parentElement as Element).setPointerCapture(e.pointerId);
                  const pt = aPunto(e);
                  setArrastre({ modo: "ajustar", id: sel.id, r0: sel.r, a: pt, b: pt });
                }}
              />
            )}
          </div>
        )}

        {p.textoAbierto && (
          <EditorTexto
            x={(p.textoAbierto.x - p.info.x0) * p.zoom}
            y={(p.textoAbierto.y - p.info.y0) * p.zoom}
            tam={(p.textoAbierto.tam ?? p.tamTexto) * p.zoom}
            color={p.textoAbierto.color ?? p.colorCss}
            inicial={p.textoAbierto.inicial}
            alTerminar={p.alTerminarTexto}
          />
        )}
      </div>
    </div>
  );
}

// Cuadro para escribir. Con "inicial" edita un texto que ya estaba (tapa al de abajo mientras tanto).
// Devuelve null si se cancela (Escape) y "" si se dejó vacío.
function EditorTexto(p: { x: number; y: number; tam: number; color: string; inicial?: string; alTerminar: (t: string | null) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const hecho = useRef(false);
  const ajustar = (t: HTMLTextAreaElement) => {
    t.style.height = "auto";
    t.style.height = t.scrollHeight + "px";
    t.style.width = "auto";
    t.style.width = Math.max(120, t.scrollWidth + 8) + "px";
  };
  useEffect(() => {
    const el = ref.current;
    if (el && p.inicial !== undefined) { el.value = p.inicial; ajustar(el); }
    const t = setTimeout(() => {
      el?.focus({ preventScroll: true });
      if (el && p.inicial) el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function terminar(t: string | null) {
    if (hecho.current) return;
    hecho.current = true;
    p.alTerminar(t === null ? null : t.trim() ? t : "");
  }
  return (
    <textarea
      ref={ref}
      className={"editor-texto" + (p.inicial !== undefined ? " editor-texto--editando" : "")}
      style={{ left: p.x, top: p.y, fontSize: p.tam, color: p.color }}
      rows={1}
      onPointerDown={(e) => e.stopPropagation()}
      onInput={(e) => ajustar(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Escape") terminar(null);
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) terminar(e.currentTarget.value);
      }}
      onBlur={(e) => terminar(e.currentTarget.value)}
    />
  );
}
