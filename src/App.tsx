import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderOpen, Save, Undo2, MousePointer2, Highlighter, Underline, Strikethrough, Type, Square,
  PenLine, Signature, EyeOff, Trash2, ZoomIn, ZoomOut, MoveHorizontal, ShieldCheck, Languages,
} from "lucide-react";
import { motor, type Anotacion, type InfoDoc, type Rect } from "./motor/motor";
import Pagina, { type Accion, type Herramienta, type Seleccion } from "./componentes/Pagina";
import Miniaturas from "./componentes/Miniaturas";
import FirmaModal, { firmaGuardada, type Firma } from "./componentes/FirmaModal";
import { abrirConDialogo, archivoInicial, desdeArchivo, guardarConDialogo, type Abierto } from "./archivos";
import { T, IDIOMAS, idioma, cambiarIdioma, type Idioma } from "./i18n";
import Labcin, { type EventoLabcin } from "./labcin/Labcin";

const COLORES: { id: string; css: string; rgb: number[] }[] = [
  { id: "rojo", css: "#D3261D", rgb: [0.83, 0.15, 0.11] },
  { id: "azul", css: "#1F5FD1", rgb: [0.12, 0.37, 0.82] },
  { id: "negro", css: "#1B1C20", rgb: [0.1, 0.1, 0.12] },
  { id: "verde", css: "#1E8A4C", rgb: [0.12, 0.54, 0.3] },
  { id: "amarillo", css: "#F2C200", rgb: [1, 0.82, 0] },
];
const COLOR_RESALTE = [1, 0.85, 0.1];

type Paso =
  | { tipo: "crear"; pagina: number; id: number }
  | { tipo: "mover"; pagina: number; id: number; dx: number; dy: number }
  | { tipo: "ajustar"; pagina: number; id: number; r: Rect };

const HERRAMIENTAS: { id: Herramienta; icono: typeof Type; nombre: string; ayuda: string }[] = [
  { id: "seleccionar", icono: MousePointer2, nombre: "Seleccionar", ayuda: "Tocá una anotación para moverla o borrarla." },
  { id: "resaltar", icono: Highlighter, nombre: "Resaltar", ayuda: "Arrastrá sobre el texto para resaltarlo." },
  { id: "subrayar", icono: Underline, nombre: "Subrayar", ayuda: "Arrastrá sobre el texto para subrayarlo." },
  { id: "tachar", icono: Strikethrough, nombre: "Tachar", ayuda: "Arrastrá sobre el texto para tacharlo." },
  { id: "texto", icono: Type, nombre: "Texto", ayuda: "Tocá donde querés escribir." },
  { id: "recuadro", icono: Square, nombre: "Recuadro", ayuda: "Arrastrá para dibujar un recuadro." },
  { id: "dibujar", icono: PenLine, nombre: "Dibujar", ayuda: "Dibujá a mano alzada sobre la página." },
  { id: "firma", icono: Signature, nombre: "Firmar", ayuda: "Tocá donde va la firma." },
  { id: "censurar", icono: EyeOff, nombre: "Censurar", ayuda: "Marcá lo que querés ocultar. Se borra de verdad al guardar." },
];

// Tip que da Labcin la primera vez que se elige cada herramienta.
const TIP_HERRAMIENTA: Partial<Record<Herramienta, string>> = {
  seleccionar: "Tocá una anotación para moverla. Con Supr la borrás.",
  resaltar: "Arrastrá sobre el texto como si lo seleccionaras. Si no marca nada, puede ser un PDF escaneado.",
  subrayar: "Arrastrá sobre el texto como si lo seleccionaras. Si no marca nada, puede ser un PDF escaneado.",
  tachar: "Arrastrá sobre el texto como si lo seleccionaras. Si no marca nada, puede ser un PDF escaneado.",
  texto: "Escribí y tocá afuera para terminar. Ctrl+Enter también sirve.",
  recuadro: "Ideal para destacar una zona. El color lo elegís en la barra.",
  dibujar: "Perfecto para un círculo o una flecha rápida.",
  firma: "Tu firma queda guardada solo en este equipo. Después de ponerla, la agrandás desde la esquina.",
  censurar: "Ojo: la censura borra de verdad lo que está debajo al guardar. Ideal para DNI, CBU o direcciones.",
};

const CON_COLOR = new Set<Herramienta>(["subrayar", "tachar", "texto", "recuadro", "dibujar"]);

export default function App() {
  const [, refrescarIdioma] = useState(idioma());
  const [doc, setDoc] = useState<InfoDoc | null>(null);
  const [archivo, setArchivo] = useState<{ nombre: string; ruta?: string } | null>(null);
  const [pidiendoClave, setPidiendoClave] = useState<{ error?: boolean } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [herramienta, setHerramienta] = useState<Herramienta>("seleccionar");
  const [color, setColor] = useState(COLORES[0]);
  const [tamTexto, setTamTexto] = useState(14);
  const [versiones, setVersiones] = useState<Record<number, number>>({});
  const [anots, setAnots] = useState<Record<number, Anotacion[]>>({});
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [historial, setHistorial] = useState<Paso[]>([]);
  const [cambios, setCambios] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo?: "error" | "ok" } | null>(null);
  const [firma, setFirma] = useState<Firma | null>(() => firmaGuardada());
  const [modalFirma, setModalFirma] = useState(false);
  const [confirmarCensura, setConfirmarCensura] = useState<number | null>(null);
  const [textoAbierto, setTextoAbierto] = useState<{ pagina: number; x: number; y: number } | null>(null);
  const [actual, setActual] = useState(0);
  const [arrastrandoArchivo, setArrastrandoArchivo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [intro, setIntro] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), 2750);
    return () => clearTimeout(t);
  }, [intro]);
  const vista = useRef<HTMLDivElement>(null);
  const [eventoLabcin, setEventoLabcin] = useState<EventoLabcin | null>(null);
  const tipsDados = useRef(new Set<string>());
  const labcin = useCallback((texto: string, tipo?: EventoLabcin["tipo"]) => {
    setEventoLabcin((e) => ({ texto: T(texto), tipo, n: (e?.n || 0) + 1 }));
  }, []);
  const visibles = useRef(new Set<number>());

  const avisar = useCallback((texto: string, tipo?: "error" | "ok") => {
    setAviso({ texto, tipo });
    window.clearTimeout((avisar as any)._t);
    (avisar as any)._t = window.setTimeout(() => setAviso(null), 3800);
  }, []);

  // ---------- abrir ----------
  function ajustarAncho(info: InfoDoc, limitar = true) {
    const ancho = (vista.current?.clientWidth || window.innerWidth) - 40;
    const mayor = Math.max(...info.paginas.map((p) => p.w));
    const z = ancho / mayor;
    setZoom(limitar ? Math.min(z, 1.35) : z);
  }

  async function cargar(a: Abierto | null) {
    if (!a) return;
    if (cambios && !window.confirm(T("Hay cambios sin guardar. ¿Abrir otro archivo igual?"))) return;
    setOcupado(true);
    try {
      const r = await motor.abrir(a.datos);
      setArchivo({ nombre: a.nombre, ruta: a.ruta });
      reiniciar();
      if ("necesitaClave" in r) {
        setDoc(null);
        setPidiendoClave({});
      } else listo(r);
    } catch {
      avisar(T("No se pudo abrir el archivo. Verificá que sea un PDF válido."), "error");
    } finally {
      setOcupado(false);
    }
  }

  function reiniciar() {
    setVersiones({}); setAnots({}); setSeleccion(null); setHistorial([]); setCambios(false);
    setTextoAbierto(null); setActual(0); visibles.current.clear();
  }

  function listo(info: InfoDoc) {
    setDoc(info);
    setPidiendoClave(null);
    if (!tipsDados.current.has("abrir")) {
      tipsDados.current.add("abrir");
      const celular = window.matchMedia("(max-width: 760px)").matches;
      setTimeout(() => labcin(celular
        ? "Elegí una herramienta de abajo. Si te equivocás, tocá deshacer."
        : "Elegí una herramienta de arriba. Si te equivocás, Ctrl+Z deshace."), 600);
    }
    requestAnimationFrame(() => {
      ajustarAncho(info);
      vista.current?.scrollTo({ top: 0 });
    });
  }

  async function probarClave(clave: string) {
    const r = await motor.clave(clave);
    if ("incorrecta" in r) setPidiendoClave({ error: true });
    else listo(r);
  }

  // ---------- anotaciones ----------
  const recargar = useCallback(async (pagina: number) => {
    const lista = await motor.anotaciones(pagina);
    setAnots((a) => ({ ...a, [pagina]: lista }));
    setVersiones((v) => ({ ...v, [pagina]: (v[pagina] || 0) + 1 }));
  }, []);

  const alVer = useCallback((i: number, visible: boolean) => {
    if (visible) {
      visibles.current.add(i);
      setAnots((a) => {
        if (!a[i]) motor.anotaciones(i).then((lista) => setAnots((b) => ({ ...b, [i]: lista })));
        return a;
      });
    } else visibles.current.delete(i);
  }, []);

  async function ejecutar(pagina: number, accion: Accion) {
    try {
      let creada: Anotacion | null = null;
      switch (accion.tipo) {
        case "resaltar": {
          const tipo = herramienta === "subrayar" ? "Underline" : herramienta === "tachar" ? "StrikeOut" : "Highlight";
          const c = herramienta === "resaltar" ? COLOR_RESALTE : color.rgb;
          creada = await motor.resaltar(pagina, accion.a, accion.b, c, tipo);
          if (!creada) {
            avisar(T("No encontré texto en esa zona. Si el PDF es escaneado, usá “Recuadro” o “Dibujar”."));
            return;
          }
          break;
        }
        case "texto":
          setTextoAbierto({ pagina, x: accion.x, y: accion.y });
          return;
        case "recuadro":
          creada = await motor.rectangulo(pagina, accion.r, color.rgb);
          break;
        case "censurar":
          creada = await motor.censurar(pagina, accion.r);
          break;
        case "dibujar":
          creada = await motor.tinta(pagina, [accion.trazo], color.rgb, 2);
          break;
        case "firma": {
          if (!firma) return setModalFirma(true);
          const w = 150, h = w / firma.aspecto;
          const r: Rect = [accion.x - w / 2, accion.y - h / 2, accion.x + w / 2, accion.y + h / 2];
          creada = await motor.firma(pagina, r, firma.png);
          await recargar(pagina);
          setHistorial((h) => [...h, { tipo: "crear", pagina, id: creada!.id }]);
          setCambios(true);
          setHerramienta("seleccionar");
          setSeleccion({ pagina, id: creada.id });
          return;
        }
        case "mover": {
          await motor.mover(pagina, accion.id, accion.dx, accion.dy);
          setHistorial((h) => [...h, { tipo: "mover", pagina, id: accion.id, dx: accion.dx, dy: accion.dy }]);
          break;
        }
        case "ajustar": {
          const previo = anots[pagina]?.find((a) => a.id === accion.id);
          await motor.ajustar(pagina, accion.id, accion.r);
          if (previo) setHistorial((h) => [...h, { tipo: "ajustar", pagina, id: accion.id, r: previo.r }]);
          break;
        }
      }
      if (creada) setHistorial((h) => [...h, { tipo: "crear", pagina, id: creada!.id }]);
      setCambios(true);
      await recargar(pagina);
    } catch (e) {
      console.error(e);
    }
  }

  async function terminarTexto(texto: string | null) {
    const t = textoAbierto;
    setTextoAbierto(null);
    if (!t || !texto) return;
    const creada = await motor.texto(t.pagina, t.x, t.y - tamTexto * 0.3, texto, tamTexto, color.rgb);
    setHistorial((h) => [...h, { tipo: "crear", pagina: t.pagina, id: creada.id }]);
    setCambios(true);
    await recargar(t.pagina);
  }

  async function deshacer() {
    const paso = historial[historial.length - 1];
    if (!paso) return;
    setHistorial((h) => h.slice(0, -1));
    try {
      if (paso.tipo === "crear") await motor.borrar(paso.pagina, paso.id);
      if (paso.tipo === "mover") await motor.mover(paso.pagina, paso.id, -paso.dx, -paso.dy);
      if (paso.tipo === "ajustar") await motor.ajustar(paso.pagina, paso.id, paso.r);
    } catch { /* la anotación ya no existe */ }
    setSeleccion(null);
    await recargar(paso.pagina);
  }

  async function borrarSeleccion() {
    if (!seleccion) return;
    const s = seleccion;
    setSeleccion(null);
    await motor.borrar(s.pagina, s.id);
    setHistorial((h) => h.filter((p) => !(p.pagina === s.pagina && p.id === s.id)));
    setCambios(true);
    await recargar(s.pagina);
  }

  // ---------- guardar ----------
  async function guardar(censurarYa = false) {
    if (!doc || !archivo) return;
    const pendientes = await motor.censurasPendientes();
    if (pendientes > 0 && !censurarYa) return setConfirmarCensura(pendientes);
    setConfirmarCensura(null);
    setOcupado(true);
    try {
      if (pendientes > 0) {
        const cambiadas = await motor.aplicarCensura();
        for (const i of cambiadas) await recargar(i);
        setHistorial((h) => h.filter((p) => !cambiadas.includes(p.pagina)));
      }
      const { datos } = await motor.guardar();
      const ok = await guardarConDialogo(datos, archivo.nombre, archivo.ruta);
      if (ok) {
        setCambios(false);
        avisar(T("Guardado ✓"), "ok");
        labcin("¡Listo! Tu PDF quedó guardado.", "festejo");
      }
    } catch (e) {
      console.error(e);
      avisar(T("No se pudo guardar."), "error");
    } finally {
      setOcupado(false);
    }
  }

  // Labcin saluda al abrir la app
  useEffect(() => {
    // si ya se abrió un PDF (por ejemplo con "Abrir con…"), saluda sin pedir que abras uno
    const t = setTimeout(() => labcin(tipsDados.current.has("abrir")
      ? "Elegí una herramienta de arriba. Si te equivocás, Ctrl+Z deshace."
      : "¡Hola, soy Labcin! Abrí un PDF y te voy dando tips.", "saludo"), intro ? 2900 : 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labcin]);

  // abrir el PDF con el que se lanzó la app ("Abrir con… Ozone PDF")
  useEffect(() => {
    archivoInicial().then((a) => a && cargar(a)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- atajos de teclado ----------
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const escribiendo = (e.target as HTMLElement)?.closest("textarea, input");
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); abrirConDialogo().then(cargar); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); guardar(); }
      else if (escribiendo) return;
      else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); deshacer(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && seleccion) { e.preventDefault(); borrarSeleccion(); }
      else if (e.key === "Escape") { setSeleccion(null); setHerramienta("seleccionar"); }
      else if (mod && (e.key === "+" || e.key === "=")) { e.preventDefault(); setZoom((z) => Math.min(z * 1.2, 5)); }
      else if (mod && e.key === "-") { e.preventDefault(); setZoom((z) => Math.max(z / 1.2, 0.2)); }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  // avisar antes de cerrar con cambios sin guardar
  useEffect(() => {
    const antes = (e: BeforeUnloadEvent) => { if (cambios) { e.preventDefault(); } };
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [cambios]);

  // página actual según el desplazamiento
  function alDesplazar() {
    const v = vista.current;
    if (!v || !doc) return;
    const centro = v.scrollTop + v.clientHeight / 3;
    const hijos = v.querySelectorAll<HTMLElement>("[data-pagina]");
    for (const h of hijos) {
      if (h.offsetTop + h.offsetHeight > centro) { setActual(Number(h.dataset.pagina)); break; }
    }
  }

  function irA(i: number) {
    const el = vista.current?.querySelector<HTMLElement>(`[data-pagina="${i}"]`);
    if (el) vista.current!.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
  }

  function elegirHerramienta(h: Herramienta) {
    setSeleccion(null);
    setTextoAbierto(null);
    if (h === "firma" && !firma) setModalFirma(true);
    setHerramienta(h);
    const tip = TIP_HERRAMIENTA[h];
    if (tip && !tipsDados.current.has(h)) {
      tipsDados.current.add(h);
      labcin(tip);
    }
  }

  const ayuda = HERRAMIENTAS.find((h) => h.id === herramienta)!.ayuda;
  const selAnot = useMemo(
    () => (seleccion ? anots[seleccion.pagina]?.find((a) => a.id === seleccion.id) : null),
    [seleccion, anots],
  );

  return (
    <div
      className={"app" + (arrastrandoArchivo ? " app--soltando" : "") + (intro ? " con-intro" : "") + (doc ? " con-doc" : "")}
      onDragOver={(e) => { e.preventDefault(); setArrastrandoArchivo(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastrandoArchivo(false); }}
      onDrop={async (e) => {
        e.preventDefault();
        setArrastrandoArchivo(false);
        const f = [...e.dataTransfer.files].find((x) => /\.pdf$/i.test(x.name) || x.type === "application/pdf");
        if (f) cargar(await desdeArchivo(f));
      }}
    >
      <header className="barra">
        <div className="marca">
          <img className="marca__logo" src="/img/marca.png" alt="" width={34} height={34} />
          <div className="marca__texto">
            <strong>Ozone PDF</strong>
            <span className="marca__archivo" title={archivo?.nombre}>
              {archivo ? archivo.nombre + (cambios ? " •" : "") : <>Pache<span className="marca__punto">.</span>Labs</>}
            </span>
          </div>
        </div>
        <div className="barra__acciones">
          <label className="idioma" title={T("Idioma")}>
            <Languages size={17} aria-hidden />
            <select
              value={idioma()}
              aria-label={T("Idioma")}
              onChange={(e) => { cambiarIdioma(e.target.value as Idioma); refrescarIdioma(e.target.value as Idioma); }}
            >
              {IDIOMAS.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </label>
          <button className="boton boton--suave" onClick={() => abrirConDialogo().then(cargar)}>
            <FolderOpen size={18} aria-hidden /> <span>{T("Abrir")}</span>
          </button>
          <button className="boton boton--primario" onClick={() => guardar()} disabled={!doc || ocupado}>
            <Save size={18} aria-hidden /> <span>{T("Guardar")}</span>
          </button>
        </div>
      </header>

      {doc && (
        <div className="herramientas" role="toolbar" aria-label={T("Herramientas")}>
          <div className="herramientas__grupo herramientas__lista">
            {HERRAMIENTAS.map((h) => {
              const I = h.icono;
              return (
                <button
                  key={h.id}
                  className={"herr" + (herramienta === h.id ? " herr--activa" : "") + (h.id === "censurar" ? " herr--censura" : "")}
                  onClick={(e) => { elegirHerramienta(h.id); e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); }}
                  aria-pressed={herramienta === h.id}
                  title={T(h.nombre)}
                >
                  <I size={19} aria-hidden />
                  <span>{T(h.nombre)}</span>
                </button>
              );
            })}
          </div>
          <div className="herramientas__grupo herramientas__extra">
            <div className="herramientas__opciones">
            {CON_COLOR.has(herramienta) && (
              <div className="colores" role="radiogroup" aria-label={T("Color")}>
                {COLORES.filter((c) => herramienta !== "texto" || c.id !== "amarillo").map((c) => (
                  <button
                    key={c.id}
                    role="radio"
                    aria-checked={color.id === c.id}
                    aria-label={c.id}
                    className={"color" + (color.id === c.id ? " color--activo" : "")}
                    style={{ background: c.css }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            )}
            {herramienta === "texto" && (
              <select className="tam" value={tamTexto} onChange={(e) => setTamTexto(Number(e.target.value))} aria-label={T("Tamaño")}>
                {[10, 12, 14, 18, 24, 32].map((n) => <option key={n} value={n}>{n} pt</option>)}
              </select>
            )}
            {herramienta === "firma" && firma && (
              <button className="chip-firma" onClick={() => setModalFirma(true)} title={T("Cambiar firma")}>
                <img src={firma.url} alt={T("Tu firma")} /> <span>{T("Cambiar firma")}</span>
              </button>
            )}
            {selAnot && (
              <button className="boton boton--peligro boton--chico" onClick={borrarSeleccion}>
                <Trash2 size={16} aria-hidden /> {T("Borrar")}
              </button>
            )}
            </div>
            <div className="herramientas__vista">
            <button className="icono" onClick={deshacer} disabled={!historial.length} title={T("Deshacer")} aria-label={T("Deshacer")}>
              <Undo2 size={18} />
            </button>
            <span className="separador" />
            <button className="icono" onClick={() => setZoom((z) => Math.max(z / 1.2, 0.2))} title={T("Alejar")} aria-label={T("Alejar")}><ZoomOut size={18} /></button>
            <span className="zoom">{Math.round(zoom * 100)}%</span>
            <button className="icono" onClick={() => setZoom((z) => Math.min(z * 1.2, 5))} title={T("Acercar")} aria-label={T("Acercar")}><ZoomIn size={18} /></button>
            <button className="icono" onClick={() => ajustarAncho(doc, false)} title={T("Ajustar al ancho")} aria-label={T("Ajustar al ancho")}><MoveHorizontal size={18} /></button>
            </div>
          </div>
        </div>
      )}

      <main className="cuerpo">
        {doc && <Miniaturas paginas={doc.paginas} versiones={versiones} actual={actual} alElegir={irA} />}
        <div className="vista" ref={vista} onScroll={alDesplazar}>
          {doc ? (
            <>
              <p className={"ayuda" + (herramienta === "censurar" ? " ayuda--censura" : "")}>{T(ayuda)}</p>
              {doc.paginas.map((info, i) => (
                <Pagina
                  key={i}
                  indice={i}
                  info={info}
                  zoom={zoom}
                  version={versiones[i] || 0}
                  herramienta={herramienta}
                  anotaciones={anots[i] || []}
                  seleccion={seleccion}
                  textoAbierto={textoAbierto?.pagina === i ? textoAbierto : null}
                  tamTexto={tamTexto}
                  colorCss={herramienta === "resaltar" ? "#F2C200" : color.css}
                  alVer={alVer}
                  alSoltar={(a) => ejecutar(i, a)}
                  alSeleccionar={setSeleccion}
                  alTerminarTexto={terminarTexto}
                />
              ))}
              <p className="pie-vista">{T("Página {n} de {total}", { n: actual + 1, total: doc.paginas.length })}</p>
            </>
          ) : (
            <Inicio alAbrir={() => abrirConDialogo().then(cargar)} />
          )}
        </div>
      </main>

      {doc && <div className="contador">{actual + 1} / {doc.paginas.length}</div>}

      {modalFirma && (
        <FirmaModal
          alCerrar={(f) => {
            setModalFirma(false);
            if (f) { setFirma(f); setHerramienta("firma"); }
            else if (!firma) setHerramienta("seleccionar");
          }}
        />
      )}

      {pidiendoClave && <ModalClave error={!!pidiendoClave.error} alProbar={probarClave} alCancelar={() => { setPidiendoClave(null); setArchivo(null); }} />}

      {confirmarCensura !== null && (
        <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="titulo-censura">
          <div className="modal__caja">
            <h2 id="titulo-censura"><EyeOff size={20} aria-hidden /> {T("Censura definitiva")}</h2>
            <p>{T("Hay {n} zonas marcadas para censurar. Al guardar, el texto, las imágenes y los dibujos que estén debajo se borran del archivo y no se pueden recuperar.", { n: confirmarCensura })}</p>
            <div className="modal__botones">
              <span className="espacio" />
              <button className="boton boton--suave" onClick={() => setConfirmarCensura(null)}>{T("Cancelar")}</button>
              <button className="boton boton--peligro" onClick={() => guardar(true)}>{T("Censurar y guardar")}</button>
            </div>
          </div>
        </div>
      )}

      <Labcin evento={eventoLabcin} />

      {intro && (
        <div className="intro" aria-hidden onClick={() => setIntro(false)}>
          <div className="intro__marca">
            <div className="intro__frasco">
              <img src="/img/intro-avatar-solo.png" alt="" width={140} height={140} />
              <span className="burbuja b1" /><span className="burbuja b2" /><span className="burbuja b3" />
              <span className="burbuja b4">&lt;&gt;</span>
            </div>
            <p className="intro__nombre">Ozone<span>.</span>PDF</p>
            <p className="intro__de">Pache Labs</p>
          </div>
        </div>
      )}

      {aviso && <div className={"aviso" + (aviso.tipo ? ` aviso--${aviso.tipo}` : "")} role="status">{aviso.texto}</div>}
      {ocupado && <div className="cargando" aria-hidden><span /></div>}
    </div>
  );
}

function Inicio({ alAbrir }: { alAbrir: () => void }) {
  const titulo = T("Abrí un PDF para empezar");
  return (
    <section className="inicio">
      <div className="inicio__zona">
        <img src="/img/intro-avatar-solo.png" alt="" width={112} height={112} className="inicio__avatar" />
        <h1>{titulo}<span>.</span></h1>
        <p>{T("Arrastralo acá o tocá “Abrir”. Tus archivos nunca salen de tu equipo.")}</p>
        <button className="boton boton--primario boton--grande" onClick={alAbrir}>
          <FolderOpen size={20} aria-hidden /> {T("Elegir PDF")}
        </button>
        <ul className="inicio__chips">
          <li><Signature size={15} aria-hidden /> {T("Firmar")}</li>
          <li><Highlighter size={15} aria-hidden /> {T("Resaltar")}</li>
          <li><Type size={15} aria-hidden /> {T("Texto")}</li>
          <li><EyeOff size={15} aria-hidden /> {T("Censurar")}</li>
        </ul>
      </div>
      <p className="inicio__sello"><ShieldCheck size={16} aria-hidden /> {T("Sin conexión · Nada sale de tu equipo")}</p>
    </section>
  );
}

function ModalClave(p: { error: boolean; alProbar: (c: string) => void; alCancelar: () => void }) {
  const [clave, setClave] = useState("");
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-clave">
      <form className="modal__caja" onSubmit={(e) => { e.preventDefault(); p.alProbar(clave); }}>
        <h2 id="titulo-clave">{T("Este PDF tiene contraseña")}</h2>
        <input className="campo" type="password" autoFocus value={clave} onChange={(e) => setClave(e.target.value)} placeholder={T("Contraseña")} aria-label={T("Contraseña")} />
        {p.error && <p className="error">{T("Contraseña incorrecta.")}</p>}
        <div className="modal__botones">
          <span className="espacio" />
          <button type="button" className="boton boton--suave" onClick={p.alCancelar}>{T("Cancelar")}</button>
          <button className="boton boton--primario" disabled={!clave}>{T("Aceptar")}</button>
        </div>
      </form>
    </div>
  );
}
