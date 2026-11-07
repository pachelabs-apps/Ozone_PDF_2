import { useEffect, useRef, useState } from "react";
import { motor, type InfoPagina } from "../motor/motor";

export default function Miniaturas(p: {
  paginas: InfoPagina[];
  versiones: Record<number, number>;
  actual: number;
  alElegir: (i: number) => void;
}) {
  return (
    <nav className="miniaturas" aria-label="Páginas">
      {p.paginas.map((info, i) => (
        <Miniatura key={i} indice={i} info={info} version={p.versiones[i] || 0} activa={i === p.actual} alElegir={p.alElegir} />
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
