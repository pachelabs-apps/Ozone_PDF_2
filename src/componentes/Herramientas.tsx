import { useEffect, useState, type ReactNode } from "react";
import {
  Combine, Scissors, FileOutput, Minimize2, Lock, Stamp, ListOrdered, Scaling, FileImage, FileText, Eraser, Camera, X, ArrowLeft,
  RotateCw, Trash2, ArrowDownUp, Images, LockOpen, Search, ScanText, FileSearch, FileType2, FilePenLine,
} from "lucide-react";
import { T } from "../i18n";
import { motor, type InfoDoc, type Seguridad } from "../motor/motor";
import { abrirVarios, guardarArchivo, guardarVarios, base } from "../archivos";

export type IdHerramienta =
  | "unir" | "dividir" | "extraer" | "comprimir" | "clave" | "marca" | "numerar" | "ajustar" | "imagenes" | "texto" | "limpiar" | "escanear"
  | "rotar" | "eliminar" | "ordenar" | "img2pdf" | "quitarclave" | "buscable" | "ocrimg" | "word2pdf" | "pdf2word";

// Categorías en las que se muestran (en este orden). Cada herramienta sigue siendo "rapida"
// (te da un archivo nuevo y el original no se toca) o "editar" (cambia el PDF abierto; se puede deshacer).
export type Categoria = "a_pdf" | "desde_pdf" | "ocr" | "organizar" | "ajustar" | "seguridad";
export const CATEGORIAS: { id: Categoria; titulo: string; ayuda: string }[] = [
  { id: "a_pdf", titulo: "Convertir a PDF", ayuda: "De Word, de fotos o del papel, a PDF." },
  { id: "desde_pdf", titulo: "Convertir el PDF", ayuda: "Pasalo a Word, a imágenes o a texto." },
  { id: "ocr", titulo: "Reconocer texto (OCR)", ayuda: "Para escaneos y fotos de documentos." },
  { id: "organizar", titulo: "Organizar páginas", ayuda: "Uní, separá, girá y ordená." },
  { id: "ajustar", titulo: "Achicar y ajustar", ayuda: "Peso, tamaño de hoja, números y sellos." },
  { id: "seguridad", titulo: "Seguridad y privacidad", ayuda: "Contraseñas y datos ocultos." },
];

type Item = { id: IdHerramienta; icono: typeof Lock; nombre: string; desc: string; grupo: "rapida" | "editar"; categoria: Categoria; palabras?: string };

// Dentro de cada categoría, de la más usada a la menos usada.
export const LISTA: Item[] = [
  { id: "word2pdf", icono: FileType2, nombre: "Word a PDF", desc: "Pasá un documento de Word (.docx) a PDF.", grupo: "rapida", categoria: "a_pdf", palabras: "word docx doc convertir documento office" },
  { id: "img2pdf", icono: Images, nombre: "Imagen a PDF", desc: "Juntá fotos o escaneos (JPG, PNG) en un PDF.", grupo: "rapida", categoria: "a_pdf", palabras: "jpg png imagenes fotos convertir" },
  { id: "escanear", icono: Camera, nombre: "Fotos a PDF", desc: "Escaneá con la cámara, como un escáner.", grupo: "rapida", categoria: "a_pdf", palabras: "escanear escaner camara foto celular" },
  { id: "pdf2word", icono: FilePenLine, nombre: "PDF a Word", desc: "Pasalo a un .docx para editarlo en Word.", grupo: "rapida", categoria: "desde_pdf", palabras: "word docx doc convertir editar office" },
  { id: "imagenes", icono: FileImage, nombre: "PDF a imágenes", desc: "Cada página como JPG o PNG.", grupo: "rapida", categoria: "desde_pdf", palabras: "jpg png foto convertir" },
  { id: "texto", icono: FileText, nombre: "PDF a texto", desc: "Copiá todo el texto a un .txt.", grupo: "rapida", categoria: "desde_pdf", palabras: "txt copiar extraer texto" },
  { id: "buscable", icono: FileSearch, nombre: "Hacer buscable un PDF", desc: "Que un PDF escaneado se pueda buscar y copiar (OCR).", grupo: "rapida", categoria: "ocr", palabras: "ocr escaneado reconocer texto buscar copiar seleccionar leer" },
  { id: "ocrimg", icono: ScanText, nombre: "Imagen a texto", desc: "Leé el texto de fotos o escaneos (OCR).", grupo: "rapida", categoria: "ocr", palabras: "ocr reconocer leer texto foto escaneo copiar transcribir" },
  { id: "unir", icono: Combine, nombre: "Unir PDF", desc: "Juntá varios PDF en uno.", grupo: "rapida", categoria: "organizar", palabras: "juntar combinar merge" },
  { id: "dividir", icono: Scissors, nombre: "Dividir", desc: "Separá en varios archivos.", grupo: "rapida", categoria: "organizar", palabras: "separar cortar partir split" },
  { id: "extraer", icono: FileOutput, nombre: "Extraer páginas", desc: "Guardá solo las páginas que elijas.", grupo: "rapida", categoria: "organizar", palabras: "sacar copiar separar" },
  { id: "rotar", icono: RotateCw, nombre: "Rotar páginas", desc: "Girá todas o solo algunas.", grupo: "editar", categoria: "organizar", palabras: "girar dar vuelta orientacion" },
  { id: "eliminar", icono: Trash2, nombre: "Eliminar páginas", desc: "Quitá las páginas que no querés.", grupo: "editar", categoria: "organizar", palabras: "borrar sacar quitar" },
  { id: "ordenar", icono: ArrowDownUp, nombre: "Ordenar páginas", desc: "Cambiá el orden o invertilo.", grupo: "editar", categoria: "organizar", palabras: "reordenar mover invertir orden" },
  { id: "comprimir", icono: Minimize2, nombre: "Comprimir", desc: "Que pese menos para mandarlo.", grupo: "rapida", categoria: "ajustar", palabras: "achicar reducir peso liviano whatsapp mail" },
  { id: "ajustar", icono: Scaling, nombre: "Ajustar páginas", desc: "A4 o Carta, márgenes o todas verticales.", grupo: "editar", categoria: "ajustar", palabras: "a4 tamano margenes carta vertical" },
  { id: "numerar", icono: ListOrdered, nombre: "Numerar páginas", desc: "Agregá el número de página.", grupo: "editar", categoria: "ajustar", palabras: "numero paginar" },
  { id: "marca", icono: Stamp, nombre: "Marca de agua", desc: "Un texto de fondo en cada página.", grupo: "editar", categoria: "ajustar", palabras: "sello borrador confidencial" },
  { id: "clave", icono: Lock, nombre: "Proteger con contraseña", desc: "Guardá una copia con contraseña.", grupo: "rapida", categoria: "seguridad", palabras: "proteger contrasena candado seguridad password cifrar" },
  { id: "quitarclave", icono: LockOpen, nombre: "Quitar contraseña", desc: "Una copia sin contraseña, si la sabés.", grupo: "rapida", categoria: "seguridad", palabras: "desproteger sacar contrasena password descifrar" },
  { id: "limpiar", icono: Eraser, nombre: "Limpiar datos ocultos", desc: "Borrá autor, programa y otros datos.", grupo: "rapida", categoria: "seguridad", palabras: "privacidad metadatos autor adjuntos" },
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
  alConArchivo: (id: IdHerramienta) => void; // pide un PDF y después abre la herramienta
  alRecargar: (info: InfoDoc) => void;        // vuelve a dibujar el PDF abierto sin marcarlo como cambiado
  seguridad: Seguridad | null;
  alBloqueado: () => void;
  alRapida: (id: IdHerramienta) => void;      // herramientas rápidas: abren su propia pantalla
};

function tam(b: number) {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".0", "")} MB`;
}

// Panel con todas las herramientas de Ozone PDF y la ventana de cada una.
function normalizar(t: string) { return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

export default function Herramientas(p: Props) {
  const [q, setQ] = useState("");
  const [abierta, setAbierta] = useState<IdHerramienta | null>(p.inicial ?? null);

  function elegir(id: IdHerramienta) {
    const item = LISTA.find((x) => x.id === id);
    if (item?.grupo === "rapida" && id !== "escanear") { p.alCerrar(); p.alRapida(id); return; }
    if (id === "escanear") { p.alCerrar(); p.alEscanear(); return; }
    if (id === "ajustar") { p.alCerrar(); p.alAjustar(); return; }
    if (!p.doc) { p.alCerrar(); p.alConArchivo(id); return; }
    // PDF con restricciones: solo lo que el autor permite (leer el texto o imprimir a imágenes)
    const s = p.seguridad;
    if (s?.restringido && !(id === "texto" && s.permisos.copiar) && !(id === "imagenes" && s.permisos.imprimir)) { p.alCerrar(); p.alBloqueado(); return; }
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



  const busca = normalizar(q.trim());
  // primero las que empiezan con lo buscado, después las que lo tienen en el nombre, después el resto
  const filtradas = !busca ? LISTA : LISTA
    .map((h) => {
      const titulo = normalizar(`${T(h.nombre)} ${h.nombre}`);
      const texto = normalizar(`${T(h.nombre)} ${T(h.desc)} ${h.nombre} ${h.palabras || ""}`);
      const puntos = normalizar(T(h.nombre)).startsWith(busca) ? 3 : titulo.includes(busca) ? 2 : busca.split(/\s+/).every((w) => texto.includes(w)) ? 1 : 0;
      return { h, puntos };
    })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .map((x) => x.h);

  if (abierta) {
    const h = LISTA.find((x) => x.id === abierta)!;
    return (
      <Ventana titulo={T(h.nombre)} icono={<h.icono size={20} aria-hidden />} alVolver={() => (p.inicial ? p.alCerrar() : setAbierta(null))} alCerrar={p.alCerrar}>
        {abierta === "marca" && <Marca {...p} correr={correr} />}
        {abierta === "numerar" && <Numerar {...p} correr={correr} />}
        {abierta === "rotar" && <Rotar {...p} correr={correr} />}
        {abierta === "eliminar" && <Eliminar {...p} correr={correr} />}
        {abierta === "ordenar" && <Ordenar {...p} correr={correr} />}

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
        <label className="paleta__buscar herr-buscar">
          <Search size={18} aria-hidden />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Buscar herramienta")} aria-label={T("Buscar herramienta")}
            onKeyDown={(e) => {
              if (e.key === "Escape" && q) { e.stopPropagation(); setQ(""); }
              if (e.key === "Enter") { const h = filtradas[0]; if (h) elegir(h.id); }
            }} />
        </label>
        {!filtradas.length && <p className="paleta__vacio">{T("No encontré nada con eso. Probá con otra palabra.")}</p>}
        {filtradas.length > 0 && <p className="grupo-herr__leyenda">{T(p.doc
          ? "Casi todas te dan un archivo nuevo y no tocan el original. Las que dicen «En el PDF abierto» cambian el que estás viendo (se puede deshacer)."
          : "Casi todas te dan un archivo nuevo y no tocan el original. Las que dicen «En el PDF abierto» te piden abrir uno primero.")}</p>}
        {CATEGORIAS.filter((c) => filtradas.some((h) => h.categoria === c.id)).map((c) => (
          <section key={c.id} className="grupo-herr" aria-labelledby={`grupo-${c.id}`}>
            <h3 id={`grupo-${c.id}`} className="grupo-herr__titulo">{T(c.titulo)}</h3>
            <p className="grupo-herr__ayuda">{T(c.ayuda)}</p>
            <ul className="tarjetas">
              {filtradas.filter((h) => h.categoria === c.id).map((h, i) => {
                const I = h.icono;
                return (
                  <li key={h.id} style={{ animationDelay: `${i * 25}ms` }}>
                    <button className={"tarjeta" + (h.grupo === "editar" ? " tarjeta--editar" : "")} onClick={() => elegir(h.id)}>
                      <span className="tarjeta__icono"><I size={22} aria-hidden /></span>
                      <strong>{T(h.nombre)}</strong>
                      <small>{T(h.desc)}</small>
                      {h.grupo === "editar" && <em className="tarjeta__etiqueta">{T("En el PDF abierto")}</em>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
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




// ---------- rotar ----------
function Rotar(p: Sub) {
  const [rangos, setRangos] = useState("");
  const [grados, setGrados] = useState(90);
  async function hacer() {
    const r = await p.correr(async () => { await p.alPreparar(); return motor.rotarRangos(rangos, grados); });
    if (!r) return;
    const { cambiadas, ...info } = r;
    p.alCambiarDoc(info);
    p.alAviso(cambiadas === 1 ? T("Listo: 1 página girada.") : T("Listo: {n} páginas giradas.", { n: cambiadas }), "ok");
    p.alCerrar();
  }
  return (
    <div className="opciones">
      <Opciones nombre="grados" titulo="Girar" valor={grados} alCambiar={setGrados}
        opciones={[{ v: 90, t: "90° a la derecha" }, { v: 180, t: "180°" }, { v: 270, t: "90° a la izquierda" }]} />
      <label className="campo-etiqueta">{T("Páginas (vacío = todas)")}
        <input className="campo" value={rangos} onChange={(e) => setRangos(e.target.value)} placeholder="1-3, 5" onKeyDown={(e) => e.key === "Enter" && hacer()} />
      </label>
      <Botones><button className="boton boton--primario" onClick={hacer}>{T("Rotar")}</button></Botones>
    </div>
  );
}

// ---------- eliminar ----------
function Eliminar(p: Sub) {
  const [rangos, setRangos] = useState("");
  const total = p.doc!.paginas.length;
  async function hacer() {
    const r = await p.correr(async () => { await p.alPreparar(); return motor.borrarRangos(rangos); });
    if (!r) return;
    const { cambiadas, ...info } = r;
    p.alCambiarDoc(info);
    p.alAviso(cambiadas === 1 ? T("Listo: se borró 1 página. Ctrl+Z la recupera.") : T("Listo: se borraron {n} páginas. Ctrl+Z las recupera.", { n: cambiadas }), "ok");
    p.alCerrar();
  }
  return (
    <div className="opciones">
      <label className="campo-etiqueta">{T("Páginas a eliminar")}
        <input className="campo" autoFocus value={rangos} onChange={(e) => setRangos(e.target.value)} placeholder={`2, 5-${Math.max(5, total)}`} onKeyDown={(e) => e.key === "Enter" && rangos.trim() && hacer()} />
      </label>
      <p className="modal__ayuda">{T("El documento tiene {n} páginas. También podés borrar una sola desde su miniatura.", { n: total })}</p>
      <Botones><button className="boton boton--primario" disabled={!rangos.trim()} onClick={hacer}>{T("Eliminar")}</button></Botones>
    </div>
  );
}

// ---------- ordenar ----------
function Ordenar(p: Sub) {
  const [modo, setModo] = useState<"orden" | "invertir">("orden");
  const [orden, setOrden] = useState("");
  const total = p.doc!.paginas.length;
  async function hacer() {
    const info = await p.correr(async () => { await p.alPreparar(); return motor.reordenar(orden, modo === "invertir"); });
    if (!info) return;
    p.alCambiarDoc(info);
    p.alAviso(T("Listo: páginas ordenadas."), "ok");
    p.alCerrar();
  }
  return (
    <div className="opciones">
      <Opciones nombre="modo-orden" titulo="Cómo" valor={modo} alCambiar={setModo}
        opciones={[{ v: "orden", t: "Elegir el orden" }, { v: "invertir", t: "Invertir todo" }]} />
      {modo === "orden" && (
        <>
          <label className="campo-etiqueta">{T("Nuevo orden")}
            <input className="campo" autoFocus value={orden} onChange={(e) => setOrden(e.target.value)} placeholder={`3, 1, 2, 4-${Math.max(4, total)}`} onKeyDown={(e) => e.key === "Enter" && orden.trim() && hacer()} />
          </label>
          <p className="modal__ayuda">{T("Las páginas que escribas pasan adelante, en ese orden; las demás quedan después, como estaban. También podés arrastrar las miniaturas.")}</p>
        </>
      )}
      <Botones><button className="boton boton--primario" disabled={modo === "orden" && !orden.trim()} onClick={hacer}>{T("Ordenar")}</button></Botones>
    </div>
  );
}

