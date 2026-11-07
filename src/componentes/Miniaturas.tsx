import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { motor, type InfoPagina } from "../motor/motor";
import { T } from "../i18n";

type Props = {
  paginas: InfoPagina[];
  versiones: Record<number, number>;
  actual: number;
  alElegir: (i: number) => void;
  alRotar: (i: number, grados: number) => void;
  alBorrar: (i: number) => void;
  alMover: (de: number, a: number) => void;
};

// Miniaturas de las páginas: tocá para ir, arrastrá para ordenar, y rotá o borrá cada una.
export default function Miniaturas(p: Props) {
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [destino, setDestino] = useState<number | null>(null);
  return (
    <nav className="miniaturas" aria-label={T("Páginas")}>
      {p.paginas.map((info, i) => (
        <div
          key={i}
          className={"miniatura-env" + (destino === i && arrastrando !== null && arrastrando !== i ? (arrastrando > i ? " miniatura-env--antes" : " miniatura-env--despues") : "")
            + (arrastrando === i ? " miniatura-env--arrastrada" : "")}
          draggable
          onDragStart={(e) => { setArrastrando(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
          onDragOver={(e) => { if (arrastrando === null) return; e.preventDefault(); setDestino(i); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (arrastrando !== null && arrastrando !== i) p.alMover(arrastrando, i); setArrastrando(null); setDestino(null); }}
          onDragEnd={() => { setArrastrando(null); setDestino(null); }}
        >
          <Miniatura indice={i} info={info} version={p.versiones[i] || 0} activa={i === p.actual} alElegir={p.alElegir} />
          <div className="miniatura__acciones">
            <button onClick={() => p.alRotar(i, -90)} title={T("Rotar a la izquierda")} aria-label={T("Rotar a la izquierda")}><RotateCcw size={14} /></button>
            <button onClick={() => p.alRotar(i, 90)} title={T("Rotar a la derecha")} aria-label={T("Rotar a la derecha")}><RotateCw size={14} /></button>
            {p.paginas.length > 1 && (
              <button onClick={() => p.alBorrar(i)} title={T("Borrar página")} aria-label={T("Borrar página")}><Trash2 size={14} /></button>
            )}
          </div>
        </div>
      ))}
    </nav>
  );
}

const ANCHO = 128;

function Miniatura(p: { indice: number; info: InfoPagina; version: number; activa: boolean; alElegir: (i: number) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const escala = ANCHO / p.info.w;

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "300px 0px" });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (p.activa) ref.current?.scrollIntoView({ block: "nearest" });
  }, [p.activa]);

  useEffect(() => {
    if (!visible) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      try {
        const { w, h, pixeles } = await motor.render(p.indice, escala * dpr);
        if (cancelado || !lienzo.current) return;
        const c = lienzo.current;
        c.width = w; c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        const bmp = await createImageBitmap(new ImageData(pixeles as Uint8ClampedArray<ArrayBuffer>, w, h));
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
      } catch { /* nada */ }
    }, 250);
    return () => { cancelado = true; clearTimeout(t); };
  }, [visible, p.version, p.indice, escala]);

  return (
    <button ref={ref} className={"miniatura" + (p.activa ? " miniatura--activa" : "")} onClick={() => p.alElegir(p.indice)}>
      <canvas ref={lienzo} style={{ width: ANCHO, height: p.info.h * escala }} />
      <span>{p.indice + 1}</span>
    </button>
  );
}
