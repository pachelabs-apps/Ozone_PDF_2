import { useEffect, useState, type ReactNode } from "react";
import {
  Combine, Scissors, FileOutput, Minimize2, Lock, Stamp, ListOrdered, Scaling, FileImage, FileText, Eraser, Camera, X, ArrowLeft,
} from "lucide-react";
import { T } from "../i18n";
import { motor, type InfoDoc } from "../motor/motor";
import { abrirVarios, guardarArchivo, guardarVarios, base } from "../archivos";

export type IdHerramienta =
  | "unir" | "dividir" | "extraer" | "comprimir" | "clave" | "marca" | "numerar" | "ajustar" | "imagenes" | "texto" | "limpiar" | "escanear";

export const LISTA: { id: IdHerramienta; icono: typeof Lock; nombre: string; desc: string; sinDoc?: boolean }[] = [
  { id: "unir", icono: Combine, nombre: "Unir PDF", desc: "Juntá varios PDF en uno.", sinDoc: true },
  { id: "escanear", icono: Camera, nombre: "Escanear", desc: "De fotos a PDF, como un escáner.", sinDoc: true },
  { id: "dividir", icono: Scissors, nombre: "Dividir", desc: "Separá en varios archivos.", },
  { id: "extraer", icono: FileOutput, nombre: "Extraer páginas", desc: "Guardá solo las páginas que elijas." },
  { id: "comprimir", icono: Minimize2, nombre: "Comprimir", desc: "Que pese menos para mandarlo." },
  { id: "clave", icono: Lock, nombre: "Contraseña", desc: "Poné o sacá una contraseña." },
  { id: "marca", icono: Stamp, nombre: "Marca de agua", desc: "Un texto de fondo en cada página." },
  { id: "numerar", icono: ListOrdered, nombre: "Numerar páginas", desc: "Agregá el número de página." },
  { id: "ajustar", icono: Scaling, nombre: "Ajustar páginas", desc: "Todas en A4 o Carta, con márgenes." },
  { id: "imagenes", icono: FileImage, nombre: "PDF a imágenes", desc: "Cada página como JPG o PNG." },
  { id: "texto", icono: FileText, nombre: "PDF a texto", desc: "Copiá todo el texto a un .txt." },
  { id: "limpiar", icono: Eraser, nombre: "Limpiar datos ocultos", desc: "Borrá autor, programa y otros datos." },
];

export type OpcionesGuardado = { clave?: string; quitarClave?: boolean };

type Props = {
  doc: InfoDoc | null;
  nombre: string;
  ruta?: string;
  abiertoConClave: boolean;
  guardado: OpcionesGuardado;
  inicial?: IdHerramienta | null;
  alCerrar: () => void;
  alCambiarDoc: (info: InfoDoc, nombreNuevo?: string) => void;
  alPreparar: () => Promise<void>;
  alGuardado: (o: OpcionesGuardado) => void;
  alAviso: (t: string, tipo?: "ok" | "error") => void;
  alEscanear: () => void;
  alAjustar: () => void;
  alOcupado: (b: boolean) => void;
};

function tam(b: number) {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".0", "")} MB`;
}

// Panel con todas las herramientas de Ozone PDF y la ventana de cada una.
export default function Herramientas(p: Props) {
  const [abierta, setAbierta] = useState<IdHerramienta | null>(p.inicial && p.inicial !== "unir" ? p.inicial : null);
  useEffect(() => {
    if (p.inicial === "unir") unir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegir(id: IdHerramienta) {
    if (id === "escanear") { p.alCerrar(); p.alEscanear(); return; }
    if (id === "ajustar") { p.alCerrar(); p.alAjustar(); return; }
    if (id === "unir") { unir(); return; }
    setAbierta(id);
  }

  async function correr<R>(f: () => Promise<R>): Promise<R | undefined> {
    p.alOcupado(true);
    try {
      return await f();
    } catch (e: any) {
      console.error(e);
      const m = String(e?.message || "");
      p.alAviso(m.includes("RANGO") ? T("Revisá las páginas: por ejemplo 1-3, 5")
        : m.includes("CON_CLAVE") ? T("Uno de los PDF tiene contraseña. Abrilo primero y guardalo sin contraseña.")
        : m.includes("TODAS") ? T("No se pueden borrar todas las páginas.")
        : T("Algo salió mal. Probá de nuevo."), "error");
    } finally {
      p.alOcupado(false);
    }
  }

  async function unir() {
    const archivos = await abrirVarios();
    if (!archivos.length) { if (p.inicial === "unir") p.alCerrar(); return; }
    p.alCerrar();
    await correr(async () => {
      if (p.doc) await p.alPreparar();
      const info = await motor.unir(archivos.map((a) => new Uint8Array(a.datos)));
      p.alCambiarDoc(info, p.doc ? undefined : `${base(archivos[0].nombre)} + ${archivos.length - 1}.pdf`);
      p.alAviso(T("Listo: se agregaron {n} archivos.", { n: archivos.length }), "ok");
    });
  }

  if (p.inicial === "unir" && !abierta) return null;

  if (abierta) {
    const h = LISTA.find((x) => x.id === abierta)!;
    return (
      <Ventana titulo={T(h.nombre)} icono={<h.icono size={20} aria-hidden />} alVolver={() => (p.inicial ? p.alCerrar() : setAbierta(null))} alCerrar={p.alCerrar}>
        {abierta === "dividir" && <Dividir {...p} correr={correr} />}
        {abierta === "extraer" && <Extraer {...p} correr={correr} />}
        {abierta === "comprimir" && <Comprimir {...p} correr={correr} />}
        {abierta === "clave" && <Clave {...p} />}
        {abierta === "marca" && <Marca {...p} correr={correr} />}
        {abierta === "numerar" && <Numerar {...p} correr={correr} />}
        {abierta === "imagenes" && <AImagenes {...p} correr={correr} />}
        {abierta === "texto" && <ATexto {...p} correr={correr} />}
        {abierta === "limpiar" && <Limpiar {...p} correr={correr} />}
      </Ventana>
    );
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-herr" onPointerDown={(e) => e.target === e.currentTarget && p.alCerrar()}>
      <div className="modal__caja modal__caja--herramientas">
        <div className="modal__cabeza">
          <h2 id="titulo-herr">{T("Herramientas")}</h2>
          <button className="icono" onClick={p.alCerrar} aria-label={T("Cerrar")}><X size={20} /></button>
        </div>
        <ul className="tarjetas">
          {LISTA.map((h, i) => {
            const I = h.icono;
            const deshabilitada = !p.doc && !h.sinDoc;
            return (
              <li key={h.id} style={{ animationDelay: `${i * 25}ms` }}>
                <button className="tarjeta" disabled={deshabilitada} onClick={() => elegir(h.id)}>
                  <span className="tarjeta__icono"><I size={22} aria-hidden /></span>
                  <strong>{T(h.nombre)}</strong>
                  <small>{T(h.desc)}</small>
                </button>
              </li>
            );
          })}
        </ul>
        {!p.doc && <p className="modal__ayuda">{T("Abrí un PDF para usar el resto de las herramientas.")}</p>}
      </div>
    </div>
  );
}

function Ventana(p: { titulo: string; icono: ReactNode; children: ReactNode; alVolver: () => void; alCerrar: () => void }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={p.titulo} onPointerDown={(e) => e.target === e.currentTarget && p.alCerrar()}>
      <div className="modal__caja">
        <div className="modal__cabeza">
          <button className="icono" onClick={p.alVolver} aria-label={T("Volver")}><ArrowLeft size={20} /></button>
          <h2>{p.icono} {p.titulo}</h2>
          <button className="icono" onClick={p.alCerrar} aria-label={T("Cerrar")}><X size={20} /></button>
        </div>
        {p.children}
      </div>
    </div>
  );
}

function Opciones<V extends string | number>(p: { titulo: string; valor: V; opciones: { v: V; t: string }[]; alCambiar: (v: V) => void; nombre: string }) {
  return (
    <fieldset>
      <legend>{T(p.titulo)}</legend>
      <div className="segmentos">
        {p.opciones.map((o) => (
          <label key={String(o.v)}>
            <input type="radio" name={p.nombre} checked={p.valor === o.v} onChange={() => p.alCambiar(o.v)} />
            <span>{T(o.t)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type Sub = Props & { correr: <R>(f: () => Promise<R>) => Promise<R | undefined> };

function Botones(p: { children: ReactNode }) {
  return <div className="modal__botones"><span className="espacio" />{p.children}</div>;
}

// ---------- dividir ----------
function Dividir(p: Sub) {
  const [modo, setModo] = useState<"cada" | "rangos" | "tamano">("cada");
  const [rangos, setRangos] = useState("");
  const [mb, setMb] = useState(5);
  const total = p.doc!.paginas.length;
  async function hacer() {
    const valor = modo === "rangos" ? rangos : modo === "tamano" ? mb * 1024 * 1024 : null;
    const r = await p.correr(() => motor.dividir(modo, valor));
    if (!r) return;
    const b = base(p.nombre);
    const archivos = r.partes.map((x, i) => ({
      nombre: `${b} - ${T("parte")} ${i + 1}${x.desde === x.hasta ? ` (p${x.desde})` : ` (p${x.desde}-${x.hasta})`}.pdf`,
      datos: x.datos,
    }));
    if (await guardarVarios(archivos)) { p.alAviso(T("Listo: se crearon {n} archivos.", { n: archivos.length }), "ok"); p.alCerrar(); }
  }
  return (
    <div className="opciones">
      <Opciones nombre="modo" titulo="Cómo dividir" valor={modo} alCambiar={setModo}
        opciones={[{ v: "cada", t: "Cada página por separado" }, { v: "rangos", t: "Por rangos" }, { v: "tamano", t: "Por tamaño" }]} />
      {modo === "cada" && <p className="modal__ayuda">{T("Se crean {n} archivos, uno por página.", { n: total })}</p>}
      {modo === "rangos" && (
        <label className="campo-etiqueta">{T("Rangos separados por punto y coma")}
          <input className="campo" value={rangos} onChange={(e) => setRangos(e.target.value)} placeholder={`1-3; 4-${Math.max(4, total)}`} />
        </label>
      )}
      {modo === "tamano" && (
        <Opciones nombre="mb" titulo="Máximo por archivo" valor={mb} alCambiar={setMb}
          opciones={[1, 2, 5, 10, 20].map((v) => ({ v, t: `${v} MB` }))} />
      )}
      <Botones>
        <button className="boton boton--primario" disabled={modo === "rangos" && !rangos.trim()} onClick={hacer}>{T("Dividir")}</button>
      </Botones>
    </div>
  );
}

// ---------- extraer ----------
function Extraer(p: Sub) {
  const [rangos, setRangos] = useState("");
  async function hacer() {
    const r = await p.correr(() => motor.extraer(rangos));
    if (!r) return;
    if (await guardarArchivo(r.datos, `${base(p.nombre)} (p${rangos.replace(/\s+/g, "").replace(/[^\d,;-]/g, "")}).pdf`, p.ruta)) {
      p.alAviso(T("Listo: se guardaron {n} páginas en un archivo nuevo.", { n: r.paginas }), "ok");
      p.alCerrar();
    }
  }
  return (
    <div className="opciones">
      <label className="campo-etiqueta">{T("Páginas a extraer")}
        <input className="campo" autoFocus value={rangos} onChange={(e) => setRangos(e.target.value)} placeholder="1-3, 5" onKeyDown={(e) => e.key === "Enter" && rangos && hacer()} />
      </label>
      <p className="modal__ayuda">{T("El PDF abierto no cambia. Las páginas elegidas se guardan en un archivo nuevo.")}</p>
      <Botones><button className="boton boton--primario" disabled={!rangos.trim()} onClick={hacer}>{T("Extraer")}</button></Botones>
    </div>
  );
}

// ---------- comprimir ----------
function Comprimir(p: Sub) {
  const [nivel, setNivel] = useState("equilibrada");
  const [actual, setActual] = useState<number | null>(null);
  useEffect(() => { motor.tamanoActual().then(setActual).catch(() => {}); }, []);
  async function hacer() {
    const r = await p.correr(async () => { await p.alPreparar(); return motor.comprimir(nivel); });
    if (!r) return;
    const { antes, despues, achicadas, imagenes, ...info } = r;
    void imagenes;
    p.alCambiarDoc(info);
    const ahorro = Math.round((1 - despues / antes) * 100);
    p.alAviso(achicadas || ahorro > 2
      ? T("De {a} a {b} (−{p}%). Tocá Guardar para quedártelo.", { a: tam(antes), b: tam(despues), p: Math.max(0, ahorro) })
      : T("Este PDF ya estaba bien comprimido."), "ok");
    p.alCerrar();
  }
  return (
    <div className="opciones">
      {actual !== null && <p className="modal__ayuda">{T("Ahora pesa {t}.", { t: tam(actual) })}</p>}
      <Opciones nombre="nivel" titulo="Nivel" valor={nivel} alCambiar={setNivel}
        opciones={[{ v: "liviana", t: "Liviana" }, { v: "equilibrada", t: "Equilibrada" }, { v: "maxima", t: "Máxima" }]} />
      <p className="modal__ayuda">
        {T(nivel === "liviana" ? "Casi sin diferencia visible."
          : nivel === "equilibrada" ? "Ideal para mandar por mail o WhatsApp."
          : "Lo más chico posible; las fotos pierden algo de detalle.")}
      </p>
      <Botones><button className="boton boton--primario" onClick={hacer}>{T("Comprimir")}</button></Botones>
    </div>
  );
}

// ---------- contraseña ----------
function Clave(p: Props) {
  const [a, setA] = useState(p.guardado.clave || "");
  const [b, setB] = useState(p.guardado.clave || "");
  const coma = a.includes(",");
  const ok = a.length >= 4 && a === b && !coma;
  return (
    <div className="opciones">
      <p className="modal__ayuda">{T("La contraseña se aplica al guardar. Sin ella, nadie puede abrir el PDF.")}</p>
      <label className="campo-etiqueta">{T("Contraseña nueva")}
        <input className="campo" type="password" autoFocus value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" />
      </label>
      <label className="campo-etiqueta">{T("Repetila")}
        <input className="campo" type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" />
      </label>
      {a && b && a !== b && <p className="error">{T("Las contraseñas no coinciden.")}</p>}
      {coma && <p className="error">{T("La contraseña no puede tener comas.")}</p>}
      {a && a.length < 4 && <p className="modal__ayuda">{T("Usá al menos 4 caracteres.")}</p>}
      <Botones>
        {(p.abiertoConClave || p.guardado.clave) && (
          <button className="boton boton--suave" onClick={() => { p.alGuardado({ quitarClave: true }); p.alAviso(T("Al guardar, el PDF queda sin contraseña."), "ok"); p.alCerrar(); }}>
            {T("Quitar contraseña")}
          </button>
        )}
        <button className="boton boton--primario" disabled={!ok} onClick={() => { p.alGuardado({ clave: a }); p.alAviso(T("Al guardar, el PDF queda con contraseña."), "ok"); p.alCerrar(); }}>
          {T("Poner contraseña")}
        </button>
      </Botones>
    </div>
  );
}

// ---------- marca de agua ----------
const COLORES_MARCA: Record<string, string> = { gris: "#6B6F78", rojo: "#D3261D", negro: "#17181C" };
const INTENSIDAD: Record<string, number> = { suave: 0.12, media: 0.22, fuerte: 0.38 };

async function imagenMarca(texto: string, diagonal: boolean, color: string, alfa: number) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const fuente = `800 200px "Bricolage", "Atkinson", system-ui, "Microsoft YaHei UI", "Yu Gothic UI", sans-serif`;
  ctx.font = fuente;
  const w = ctx.measureText(texto).width + 80, h = 260;
  const ang = diagonal ? -Math.PI / 5.2 : 0;
  const W = Math.ceil(Math.abs(w * Math.cos(ang)) + Math.abs(h * Math.sin(ang)));
  const H = Math.ceil(Math.abs(w * Math.sin(ang)) + Math.abs(h * Math.cos(ang)));
  c.width = W; c.height = H;
  ctx.font = fuente;
  ctx.translate(W / 2, H / 2);
  ctx.rotate(ang);
  ctx.globalAlpha = alfa;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, 0, 0);
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob) };
}

function Marca(p: Sub) {
  const [texto, setTexto] = useState("CONFIDENCIAL");
  const [diagonal, setDiagonal] = useState("diagonal");
  const [color, setColor] = useState("gris");
  const [fuerza, setFuerza] = useState("media");
  const [vista, setVista] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    if (!texto.trim()) { setVista(null); return; }
    imagenMarca(texto, diagonal === "diagonal", COLORES_MARCA[color], Math.min(1, INTENSIDAD[fuerza] * 2.2)).then((r) => { url = r.url; setVista(r.url); });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [texto, diagonal, color, fuerza]);
  async function hacer() {
    const img = await imagenMarca(texto, diagonal === "diagonal", COLORES_MARCA[color], INTENSIDAD[fuerza]);
    URL.revokeObjectURL(img.url);
    const info = await p.correr(async () => { await p.alPreparar(); return motor.marcaDeAgua(img.bytes, diagonal === "diagonal" ? 0.85 : 0.75); });
    if (!info) return;
    p.alCambiarDoc(info);
    p.alAviso(T("Listo: marca de agua en todas las páginas."), "ok");
    p.alCerrar();
  }
  return (
    <div className="opciones">
      <label className="campo-etiqueta">{T("Texto")}
        <input className="campo" value={texto} maxLength={40} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <div className="vista-marca" aria-hidden>{vista && <img src={vista} alt="" />}</div>
      <Opciones nombre="dir" titulo="Dirección" valor={diagonal} alCambiar={setDiagonal} opciones={[{ v: "diagonal", t: "Diagonal" }, { v: "horizontal", t: "Horizontal" }]} />
      <Opciones nombre="color" titulo="Color" valor={color} alCambiar={setColor} opciones={[{ v: "gris", t: "Gris" }, { v: "rojo", t: "Rojo" }, { v: "negro", t: "Negro" }]} />
      <Opciones nombre="fuerza" titulo="Intensidad" valor={fuerza} alCambiar={setFuerza} opciones={[{ v: "suave", t: "Suave" }, { v: "media", t: "Media" }, { v: "fuerte", t: "Fuerte" }]} />
      <Botones><button className="boton boton--primario" disabled={!texto.trim()} onClick={hacer}>{T("Agregar")}</button></Botones>
    </div>
  );
}

// ---------- numerar ----------
function Numerar(p: Sub) {
  const [posicion, setPosicion] = useState("abajo-centro");
  const [formato, setFormato] = useState("solo");
  const [desde, setDesde] = useState(1);
  async function hacer() {
    const info = await p.correr(async () => { await p.alPreparar(); return motor.numerar({ posicion, formato, tam: 10, desde }); });
    if (!info) return;
    p.alCambiarDoc(info);
    p.alAviso(T("Listo: páginas numeradas."), "ok");
    p.alCerrar();
  }
  const total = p.doc!.paginas.length;
  return (
    <div className="opciones">
      <Opciones nombre="pos" titulo="Dónde" valor={posicion} alCambiar={setPosicion}
        opciones={[{ v: "abajo-centro", t: "Abajo al centro" }, { v: "abajo-derecha", t: "Abajo a la derecha" }, { v: "arriba-derecha", t: "Arriba a la derecha" }]} />
      <Opciones nombre="fmt" titulo="Formato" valor={formato} alCambiar={setFormato}
        opciones={[{ v: "solo", t: `${desde}` }, { v: "de", t: `${desde} / ${total + desde - 1}` }]} />
      <label className="campo-etiqueta">{T("Empezar en")}
        <input className="campo campo--chico" type="number" min={1} value={desde} onChange={(e) => setDesde(Math.max(1, Number(e.target.value) || 1))} />
      </label>
      <Botones><button className="boton boton--primario" onClick={hacer}>{T("Numerar")}</button></Botones>
    </div>
  );
}

// ---------- a imágenes ----------
function AImagenes(p: Sub) {
  const [formato, setFormato] = useState("jpg");
  const [dpi, setDpi] = useState(150);
  async function hacer() {
    const r = await p.correr(() => motor.aImagenes(dpi, formato));
    if (!r) return;
    const b = base(p.nombre);
    const archivos = r.lista.map((x) => ({ nombre: `${b} - ${String(x.pagina).padStart(3, "0")}.${formato}`, datos: x.datos }));
    if (await guardarVarios(archivos)) { p.alAviso(T("Listo: se crearon {n} archivos.", { n: archivos.length }), "ok"); p.alCerrar(); }
  }
  return (
    <div className="opciones">
      <Opciones nombre="fmt" titulo="Formato" valor={formato} alCambiar={setFormato} opciones={[{ v: "jpg", t: "JPG" }, { v: "png", t: "PNG" }]} />
      <Opciones nombre="dpi" titulo="Calidad" valor={dpi} alCambiar={setDpi} opciones={[{ v: 96, t: "Pantalla" }, { v: 150, t: "Normal" }, { v: 300, t: "Impresión" }]} />
      <Botones><button className="boton boton--primario" onClick={hacer}>{T("Convertir")}</button></Botones>
    </div>
  );
}

// ---------- a texto ----------
function ATexto(p: Sub) {
  async function hacer() {
    const partes = await p.correr(() => motor.aTexto());
    if (!partes) return;
    const texto = partes.map((t, i) => `— ${T("Página {n} de {total}", { n: i + 1, total: partes.length })} —\n\n${t}`).join("\n\n");
    const datos = new TextEncoder().encode(texto);
    if (await guardarArchivo(datos, `${base(p.nombre)}.txt`, p.ruta)) { p.alAviso(T("Listo: texto guardado."), "ok"); p.alCerrar(); }
  }
  return (
    <div className="opciones">
      <p className="modal__ayuda">{T("Se guarda un archivo .txt con el texto de todas las páginas. Si el PDF es escaneado, no va a tener texto.")}</p>
      <Botones><button className="boton boton--primario" onClick={hacer}>{T("Guardar texto")}</button></Botones>
    </div>
  );
}

// ---------- limpiar datos ----------
function Limpiar(p: Sub) {
  async function hacer() {
    const r = await p.correr(async () => { await p.alPreparar(); return motor.limpiarDatos(); });
    if (!r) return;
    p.alCambiarDoc({ ...p.doc!, titulo: "" });
    p.alAviso(T("Listo: datos ocultos borrados. Tocá Guardar para quedártelo."), "ok");
    p.alCerrar();
  }
  return (
    <div className="opciones">
      <p className="modal__ayuda">{T("Se borra lo que el PDF guarda sin que se vea:")}</p>
      <ul className="lista-limpia">
        <li>{T("Autor, título y programa con el que se hizo")}</li>
        <li>{T("Fechas de creación y modificación")}</li>
        <li>{T("Archivos adjuntos y código escondido")}</li>
        <li>{T("Nombres en las notas y comentarios")}</li>
      </ul>
      <Botones><button className="boton boton--primario" onClick={hacer}>{T("Limpiar")}</button></Botones>
    </div>
  );
}
