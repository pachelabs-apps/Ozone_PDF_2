import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCw, Trash2, X, ChevronLeft, ChevronRight, Check, ArrowLeft } from "lucide-react";
import { T } from "../i18n";
import type { Filtro } from "./escaner.worker";

type Punto = [number, number];
type Img = { w: number; h: number; d: Uint8ClampedArray };
type Foto = {
  id: number;
  url: string;          // la foto original, para ajustar las esquinas
  img: Img;             // la foto decodificada (achicada si era enorme)
  esquinas: Punto[];
  filtro: Filtro;
  giro: number;
  resultado?: { bytes: Uint8Array; url: string };
};

const FILTROS: { id: Filtro; nombre: string }[] = [
  { id: "original", nombre: "Original" },
  { id: "mejorado", nombre: "Mejorado" },
  { id: "grises", nombre: "Grises" },
  { id: "bn", nombre: "Blanco y negro" },
];
const LADO_MAX = 2400;

// ---------- worker de procesamiento ----------
let trabajador: Worker | null = null;
let nPedido = 0;
const pendientes = new Map<number, (v: any) => void>();
function pedir<R>(op: string, args: any, transferir: Transferable[] = []): Promise<R> {
  if (!trabajador) {
    trabajador = new Worker(new URL("./escaner.worker.ts", import.meta.url), { type: "module" });
    trabajador.onmessage = (e) => { const f = pendientes.get(e.data.id); pendientes.delete(e.data.id); f?.(e.data); };
  }
  const id = ++nPedido;
  return new Promise((ok, mal) => {
    pendientes.set(id, (m) => (m.ok ? ok(m.r) : mal(new Error(m.error))));
    trabajador!.postMessage({ id, op, args }, transferir);
  });
}

async function decodificar(blob: Blob): Promise<{ img: Img; url: string }> {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const k = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const datos = ctx.getImageData(0, 0, c.width, c.height);
  const url = await new Promise<string>((r) => c.toBlob((b) => r(URL.createObjectURL(b!)), "image/jpeg", 0.9));
  return { img: { w: c.width, h: c.height, d: datos.data }, url };
}

async function procesar(f: Foto): Promise<{ bytes: Uint8Array; url: string }> {
  // se manda una copia para no perder la foto original
  const copia = new Uint8ClampedArray(f.img.d);
  const r = await pedir<Img>("procesar", { img: { w: f.img.w, h: f.img.h, d: copia }, esquinas: f.esquinas, filtro: f.filtro, giro: f.giro }, [copia.buffer]);
  const c = document.createElement("canvas");
  c.width = r.w; c.height = r.h;
  c.getContext("2d")!.putImageData(new ImageData(r.d as Uint8ClampedArray<ArrayBuffer>, r.w, r.h), 0, 0);
  const tipo = f.filtro === "bn" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), tipo, 0.85));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob) };
}

let nFoto = 0;

export default function Escaner(p: {
  hayDocumento: boolean;
  alCerrar: () => void;
  alCrear: (imagenes: Uint8Array[], anexar: boolean) => void;
}) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [camara, setCamara] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroGeneral, setFiltroGeneral] = useState<Filtro>("mejorado");
  const celular = window.matchMedia("(pointer: coarse)").matches;

  useEffect(() => () => fotos.forEach((f) => { URL.revokeObjectURL(f.url); f.resultado && URL.revokeObjectURL(f.resultado.url); }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  async function agregar(blobs: Blob[], abrirEditor: boolean) {
    setTrabajando(true);
    try {
      const nuevas: Foto[] = [];
      for (const b of blobs) {
        const { img, url } = await decodificar(b);
        const copia = new Uint8ClampedArray(img.d);
        const esquinas = await pedir<Punto[]>("detectar", { img: { w: img.w, h: img.h, d: copia } }, [copia.buffer]);
        const f: Foto = { id: ++nFoto, url, img, esquinas, filtro: filtroGeneral, giro: 0 };
        f.resultado = await procesar(f);
        nuevas.push(f);
      }
      setFotos((a) => {
        const lista = [...a, ...nuevas];
        if (abrirEditor && nuevas.length === 1) setEditando(lista.length - 1);
        return lista;
      });
    } catch (e) {
      console.error(e);
      setError(T("No se pudo abrir el archivo. Verificá que sea un PDF válido."));
    } finally {
      setTrabajando(false);
    }
  }

  function elegir(conCamara: boolean) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (conCamara) input.setAttribute("capture", "environment");
    else input.multiple = true;
    input.onchange = () => { const l = [...(input.files || [])]; if (l.length) agregar(l, conCamara); };
    input.click();
  }

  function sacarFoto() {
    // en el celular, la cámara del sistema saca mejores fotos; en la compu se usa la cámara en vivo
    if (celular) elegir(true);
    else setCamara(true);
  }

  async function guardarEdicion(f: Foto) {
    setTrabajando(true);
    const resultado = await procesar(f);
    setFotos((a) => a.map((x) => {
      if (x.id !== f.id) return x;
      x.resultado && URL.revokeObjectURL(x.resultado.url);
      return { ...f, resultado };
    }));
    setTrabajando(false);
    setEditando(null);
  }

  async function filtroParaTodas(filtro: Filtro) {
    setFiltroGeneral(filtro);
    setTrabajando(true);
    const nuevas: Foto[] = [];
    for (const f of fotos) {
      const g = { ...f, filtro };
      f.resultado && URL.revokeObjectURL(f.resultado.url);
      g.resultado = await procesar(g);
      nuevas.push(g);
    }
    setFotos(nuevas);
    setTrabajando(false);
  }

  function mover(i: number, d: number) {
    setFotos((a) => {
      const b = [...a];
      const j = i + d;
      if (j < 0 || j >= b.length) return a;
      [b[i], b[j]] = [b[j], b[i]];
      return b;
    });
  }

  function borrar(i: number) {
    setFotos((a) => a.filter((_, k) => k !== i));
    setEditando(null);
  }

  function crear(anexar: boolean) {
    const imagenes = fotos.map((f) => f.resultado!.bytes.slice());
    p.alCrear(imagenes, anexar);
  }

  const actual = editando !== null ? fotos[editando] : null;

  return (
    <div className="escaner" role="dialog" aria-modal="true" aria-label={T("Escanear")}>
      <header className="escaner__barra">
        {actual ? (
          <button className="icono icono--claro" onClick={() => setEditando(null)} aria-label={T("Volver")}><ArrowLeft size={20} /></button>
        ) : (
          <button className="icono icono--claro" onClick={p.alCerrar} aria-label={T("Cerrar")}><X size={20} /></button>
        )}
        <strong>{T("Escanear")}</strong>
        <span className="escaner__contador">{fotos.length ? `${fotos.length}` : ""}</span>
      </header>

      {camara && (
        <CamaraEnVivo
          alSacar={(b) => { setCamara(false); agregar([b], true); }}
          alCerrar={() => setCamara(false)}
          alFallar={() => { setCamara(false); setError(T("No se pudo abrir la cámara. Podés elegir fotos que ya tengas.")); }}
        />
      )}

      {actual ? (
        <Editor
          foto={actual}
          alCambiar={(f) => setFotos((a) => a.map((x) => (x.id === f.id ? f : x)))}
          alListo={guardarEdicion}
          alBorrar={() => borrar(editando!)}
        />
      ) : (
        <div className="escaner__cuerpo">
          {!fotos.length ? (
            <div className="escaner__vacio">
              <img src="/img/intro-avatar-solo.png" alt="" width={96} height={96} />
              <p>{T("Sacá una foto de cada hoja o elegí fotos que ya tengas.")}</p>
              <div className="escaner__acciones">
                <button className="boton boton--primario boton--grande" onClick={sacarFoto}><Camera size={20} aria-hidden /> {T("Sacar foto")}</button>
                <button className="boton boton--claro boton--grande" onClick={() => elegir(false)}><ImagePlus size={20} aria-hidden /> {T("Elegir fotos")}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="escaner__filtros" role="radiogroup" aria-label={T("Filtro para todas")}>
                <span>{T("Filtro para todas")}</span>
                {FILTROS.map((f) => (
                  <button key={f.id} role="radio" aria-checked={filtroGeneral === f.id}
                    className={"chip" + (filtroGeneral === f.id ? " chip--activo" : "")} onClick={() => filtroParaTodas(f.id)}>
                    {T(f.nombre)}
                  </button>
                ))}
              </div>
              <ol className="escaner__lista">
                {fotos.map((f, i) => (
                  <li key={f.id} className="escaner__hoja">
                    <button className="escaner__miniatura" onClick={() => setEditando(i)} aria-label={`${i + 1}`}>
                      {f.resultado && <img src={f.resultado.url} alt="" />}
                      <span>{i + 1}</span>
                    </button>
                    <div className="escaner__mover">
                      <button className="icono icono--claro" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="←"><ChevronLeft size={18} /></button>
                      <button className="icono icono--claro" onClick={() => borrar(i)} aria-label={T("Borrar")}><Trash2 size={17} /></button>
                      <button className="icono icono--claro" disabled={i === fotos.length - 1} onClick={() => mover(i, 1)} aria-label="→"><ChevronRight size={18} /></button>
                    </div>
                  </li>
                ))}
                <li className="escaner__mas">
                  <button onClick={sacarFoto}><Camera size={22} aria-hidden /> {T("Sacar foto")}</button>
                  <button onClick={() => elegir(false)}><ImagePlus size={22} aria-hidden /> {T("Elegir fotos")}</button>
                </li>
              </ol>
            </>
          )}
          {error && <p className="escaner__error" role="alert">{error}</p>}
        </div>
      )}

      {!actual && fotos.length > 0 && (
        <footer className="escaner__pie">
          {p.hayDocumento && (
            <button className="boton boton--claro" disabled={trabajando} onClick={() => crear(true)}>{T("Agregar al PDF abierto")}</button>
          )}
          <button className="boton boton--primario boton--grande" disabled={trabajando} onClick={() => crear(false)}>
            <Check size={20} aria-hidden /> {T("Crear PDF")} · {fotos.length}
          </button>
        </footer>
      )}

      {trabajando && <div className="escaner__trabajando" role="status"><span className="giro" /> {T("Procesando…")}</div>}
    </div>
  );
}

// ---------- ajustar esquinas y filtro de una foto ----------
function Editor(p: { foto: Foto; alCambiar: (f: Foto) => void; alListo: (f: Foto) => void; alBorrar: () => void }) {
  const f = p.foto;
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const arrastre = useRef<number | null>(null);

  useEffect(() => {
    const el = caja.current!;
    const medir = () => {
      const r = el.getBoundingClientRect();
      const k = Math.min(r.width / f.img.w, r.height / f.img.h);
      setTam({ w: f.img.w * k, h: f.img.h * k });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [f.img.w, f.img.h]);

  const k = tam.w / f.img.w || 0;

  function mover(e: React.PointerEvent) {
    if (arrastre.current === null) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(f.img.w, Math.max(0, (e.clientX - r.left) / k));
    const y = Math.min(f.img.h, Math.max(0, (e.clientY - r.top) / k));
    const esquinas = f.esquinas.map((q, i) => (i === arrastre.current ? [x, y] : q)) as Punto[];
    p.alCambiar({ ...f, esquinas });
  }

  return (
    <div className="editor">
      <p className="editor__ayuda">{T("Ajustá las esquinas a la hoja.")}</p>
      <div className="editor__area" ref={caja}>
        <div
          className="editor__foto"
          style={{ width: tam.w, height: tam.h }}
          onPointerMove={mover}
          onPointerUp={() => (arrastre.current = null)}
          onPointerCancel={() => (arrastre.current = null)}
        >
          <img src={f.url} alt="" draggable={false} style={{ transform: `rotate(0deg)` }} />
          <svg width={tam.w} height={tam.h}>
            <path
              d={`M0,0 H${tam.w} V${tam.h} H0 Z M${f.esquinas.map(([x, y]) => `${x * k},${y * k}`).join(" L")} Z`}
              fill="rgba(14,15,18,.55)" fillRule="evenodd"
            />
            <polygon points={f.esquinas.map(([x, y]) => `${x * k},${y * k}`).join(" ")} fill="rgba(211,38,29,.08)" stroke="#D3261D" strokeWidth={2.5} strokeLinejoin="round" />
          </svg>
          {f.esquinas.map(([x, y], i) => (
            <span
              key={i}
              className="editor__esquina"
              style={{ left: x * k, top: y * k }}
              onPointerDown={(e) => { e.preventDefault(); (e.currentTarget.parentElement as Element).setPointerCapture(e.pointerId); arrastre.current = i; }}
            />
          ))}
        </div>
      </div>
      <div className="editor__filtros" role="radiogroup">
        {FILTROS.map((x) => (
          <button key={x.id} role="radio" aria-checked={f.filtro === x.id}
            className={"chip chip--oscuro" + (f.filtro === x.id ? " chip--activo" : "")} onClick={() => p.alCambiar({ ...f, filtro: x.id })}>
            <span className={`muestra muestra--${x.id}`} aria-hidden /> {T(x.nombre)}
          </button>
        ))}
      </div>
      <div className="editor__botones">
        <button className="boton boton--claro" onClick={p.alBorrar}><Trash2 size={18} aria-hidden /> {T("Borrar")}</button>
        <button className="boton boton--claro" onClick={() => p.alCambiar({ ...f, giro: (f.giro + 90) % 360 })}>
          <RotateCw size={18} aria-hidden /> {T("Rotar")}{f.giro ? ` ${f.giro}°` : ""}
        </button>
        <span className="espacio" />
        <button className="boton boton--primario" onClick={() => p.alListo(f)}><Check size={18} aria-hidden /> {T("Listo")}</button>
      </div>
    </div>
  );
}

// ---------- cámara en vivo (compu) ----------
function CamaraEnVivo(p: { alSacar: (b: Blob) => void; alCerrar: () => void; alFallar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const flujo = useRef<MediaStream | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!navigator.mediaDevices?.getUserMedia) { p.alFallar(); return; }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        flujo.current = s;
        if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); }
      })
      .catch(() => p.alFallar());
    return () => { vivo = false; flujo.current?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sacar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => b && p.alSacar(b), "image/jpeg", 0.92);
  }

  return (
    <div className="camara">
      <video ref={video} playsInline muted />
      <div className="camara__marco" aria-hidden />
      <div className="camara__botones">
        <button className="icono icono--claro" onClick={p.alCerrar} aria-label={T("Cancelar")}><X size={22} /></button>
        <button className="camara__disparador" onClick={sacar} aria-label={T("Sacar")} />
        <span style={{ width: 36 }} />
      </div>
    </div>
  );
}
