import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  FolderOpen, Save, Undo2, MousePointer2, Highlighter, Underline, Strikethrough, Type, Square,
  PenLine, Signature, EyeOff, Trash2, ZoomIn, ZoomOut, MoveHorizontal, ShieldCheck, Languages, Camera, Scaling, LayoutGrid, Lock, Accessibility, Search, Minimize2, Combine, Scissors, X, House, BadgeCheck, ShieldAlert, Files, ChevronDown, Stamp, ListOrdered, Coffee, RefreshCw, Sun, Moon, SunMoon, Settings, RotateCw, ArrowDownUp,
} from "lucide-react";
import Paleta, { type Comando } from "./componentes/Paleta";
import AccesibilidadPanel from "./componentes/Accesibilidad";
import { leerA11y, aplicarA11y, type A11y, leerTema, aplicarTema, type Tema } from "./accesibilidad";
import Rapida from "./componentes/Rapida";
import Herramientas, { LISTA, type IdHerramienta, type OpcionesGuardado } from "./componentes/Herramientas";
import Escaner from "./escaner/Escaner";
import AjustarPaginas, { type OpcionesAjuste } from "./componentes/AjustarPaginas";
import { motor, type Anotacion, type InfoDoc, type Rect, type Seguridad } from "./motor/motor";
import Pagina, { type Accion, type Herramienta, type Seleccion } from "./componentes/Pagina";
import Miniaturas from "./componentes/Miniaturas";
import Carril from "./componentes/Carril";
import FirmaModal, { firmaGuardada, type Firma } from "./componentes/FirmaModal";
import { protegerOriginal, abrirEnlace, origenInstalacion, paginaActualizaciones, abrirConDialogo, archivoInicial, alLlegarArchivo, desdeArchivo, guardarConDialogo, type Abierto } from "./archivos";
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
  | { tipo: "ajustar"; pagina: number; id: number; r: Rect }
  | { tipo: "estructura" };

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
  const [pidiendoClave, setPidiendoClave] = useState<{ error?: boolean; propietario?: boolean } | null>(null);
  const [seguridad, setSeguridad] = useState<Seguridad | null>(null);
  const [avisoSeguridad, setAvisoSeguridad] = useState<Seguridad | null>(null);
  const rutaAbierta = useRef<string | undefined>(undefined);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const [herramienta, setHerramienta] = useState<Herramienta>("seleccionar");
  const [color, setColor] = useState(COLORES[0]);
  const [tamTexto, setTamTexto] = useState(14);
  const [versiones, setVersiones] = useState<Record<number, number>>({});
  const [anots, setAnots] = useState<Record<number, Anotacion[]>>({});
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [historial, setHistorial] = useState<Paso[]>([]);
  const [cambios, setCambios] = useState(false);
  const [preguntaCerrar, setPreguntaCerrar] = useState(false);
  const [menuPaginas, setMenuPaginas] = useState(false);
  const [rapida, setRapida] = useState<{ id: IdHerramienta; inicial: Abierto | null } | null>(null);
  const datosAbiertos = useRef<ArrayBuffer | null>(null); // el PDF tal como se abrió (para las herramientas rápidas)
  const [tema, setTema] = useState<Tema>(leerTema);
  function cambiarTema(t?: Tema) {
    const nuevo = t || (tema === "claro" ? "oscuro" : tema === "oscuro" ? "auto" : "claro");
    aplicarTema(nuevo); setTema(nuevo);
    avisar(T("Tema: {t}", { t: T(NOMBRE_TEMA[nuevo]) }));
  }
  const cerrarDespues = useRef(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo?: "error" | "ok" } | null>(null);
  const [firma, setFirma] = useState<Firma | null>(() => firmaGuardada());
  const [modalFirma, setModalFirma] = useState(false);
  const [confirmarCensura, setConfirmarCensura] = useState<number | null>(null);
  const [textoAbierto, setTextoAbierto] = useState<{ pagina: number; x: number; y: number } | null>(null);
  const [actual, setActual] = useState(0);
  const [arrastrandoArchivo, setArrastrandoArchivo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [intro, setIntro] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !leerA11y().movimiento);
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), 2750);
    return () => clearTimeout(t);
  }, [intro]);
  const vista = useRef<HTMLDivElement>(null);

  // Zoom con dos dedos (celular o tablet): pellizcar sobre el PDF acerca o aleja, y el punto
  // entre los dedos queda quieto en la pantalla.
  useEffect(() => {
    const v = vista.current;
    if (!v) return;
    let inicio = 0, zoomInicio = 1, ultimo = 1, cuadro = 0, px = 0, py = 0;
    const distancia = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const empezar = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !v.querySelector(".pagina")) return;
      inicio = distancia(e.touches) || 1;
      zoomInicio = ultimo = zoomRef.current;
      const r = v.getBoundingClientRect();
      px = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      py = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
    };
    const mover = (e: TouchEvent) => {
      if (!inicio || e.touches.length !== 2) return;
      e.preventDefault();
      const z = Math.min(5, Math.max(0.2, (zoomInicio * distancia(e.touches)) / inicio));
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const f = z / ultimo;
        if (Math.abs(f - 1) < 0.004) return;
        ultimo = z;
        const x = v.scrollLeft + px, y = v.scrollTop + py;
        flushSync(() => setZoom(z));
        v.scrollLeft = x * f - px;
        v.scrollTop = y * f - py;
      });
    };
    const terminar = (e: TouchEvent) => { if (e.touches.length < 2) inicio = 0; };
    v.addEventListener("touchstart", empezar, { passive: true });
    v.addEventListener("touchmove", mover, { passive: false });
    v.addEventListener("touchend", terminar);
    v.addEventListener("touchcancel", terminar);
    return () => {
      cancelAnimationFrame(cuadro);
      v.removeEventListener("touchstart", empezar);
      v.removeEventListener("touchmove", mover);
      v.removeEventListener("touchend", terminar);
      v.removeEventListener("touchcancel", terminar);
    };
  }, []);
  const [eventoLabcin, setEventoLabcin] = useState<EventoLabcin | null>(null);
  const tipsDados = useRef(new Set<string>());
  const labcin = useCallback((texto: string, tipo?: EventoLabcin["tipo"], accion?: EventoLabcin["accion"]) => {
    setEventoLabcin((e) => ({ texto: T(texto), tipo, accion, n: (e?.n || 0) + 1 }));
  }, []);
  const [escaner, setEscaner] = useState(false);
  const [panel, setPanel] = useState<{ inicial: IdHerramienta | null } | null>(null);
  const [a11y, setA11y] = useState<A11y>(() => { const a = leerA11y(); aplicarA11y(a, false); return a; });
  const [panelA11y, setPanelA11y] = useState(false);
  const [ajustes, setAjustes] = useState(false); // menú del engranaje (en el celular: idioma, tema, accesibilidad)
  function cambiarA11y(a: A11y) { setA11y(a); aplicarA11y(a); }
  const [guardado, setGuardado] = useState<OpcionesGuardado>({});
  const [abiertoConClave, setAbiertoConClave] = useState(false);
  const claveOriginal = useRef<string | null>(null);
  const tareaPendiente = useRef<(() => void) | null>(null);
  const tamanoAbierto = useRef(0);
  const [paleta, setPaleta] = useState(false);
  const [ajustando, setAjustando] = useState(false);
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
    const tamano = a.datos.byteLength;
    const copia = a.datos.slice(0); // copia: el original se le pasa al motor
    try {
      const r = await motor.abrir(a.datos);
      // recién ahora: si el archivo estaba roto, el PDF que ya estaba abierto sigue como estaba
      tamanoAbierto.current = tamano;
      datosAbiertos.current = copia;
      rutaAbierta.current = a.ruta;
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
  }  const cargarRef = useRef(cargar); // para los avisos que llegan después (archivo compartido desde otra app)
  cargarRef.current = cargar;


  function reiniciar() {
    setVersiones({}); setAnots({}); setSeleccion(null); setHistorial([]); setCambios(false);
    setTextoAbierto(null); setActual(0); visibles.current.clear();
    setGuardado({}); setAbiertoConClave(false); claveOriginal.current = null;
    setSeguridad(null); protegerOriginal(null);
  }

  // PDF con restricciones del autor: se puede ver, pero no modificar (como en Ozone PDF 1)
  function bloqueado() {
    if (!seguridad?.restringido) return false;
    setAvisoSeguridad(seguridad);
    return true;
  }

  function listo(info: InfoDoc) {
    setDoc(info);
    setPidiendoClave(null);
    const seg = info.seguridad ?? null;
    setSeguridad(seg);
    // el original con firma digital no se puede pisar: al guardar hay que elegir otro nombre
    protegerOriginal(seg?.firma ? rutaAbierta.current : null);
    if (seg && (seg.firma || seg.restringido)) setTimeout(() => setAvisoSeguridad(seg), 450);
    else if (seg?.adjuntos) setTimeout(() => labcin(seg.adjuntos === 1 ? T("Ojo: este PDF trae un archivo adjunto adentro. Si lo vas a compartir, podés sacarlo con “Limpiar datos ocultos”.") : T("Ojo: este PDF trae {n} archivos adjuntos adentro. Si lo vas a compartir, podés sacarlos con “Limpiar datos ocultos”.", { n: seg.adjuntos }), "tip",
      { texto: T("Limpiar datos ocultos"), fn: () => abrirRapida("limpiar") }), 1300);
    const tarea = tareaPendiente.current;
    tareaPendiente.current = null;
    if (tarea) { tipsDados.current.add("abrir"); setTimeout(tarea, 350); }
    else if (tamanoAbierto.current > 8 * 1024 * 1024) {
      const mb = (tamanoAbierto.current / 1024 / 1024).toFixed(0);
      setTimeout(() => labcin(T("Este PDF pesa {t}. Si lo vas a mandar por mail o WhatsApp, lo puedo achicar.", { t: `${mb} MB` }), "tip",
        { texto: T("Achicar"), fn: () => abrirRapida("comprimir") }), 1100);
    }
    tamanoAbierto.current = 0;
    motor.tamanosMezclados().then((mezcla) => {
      if (mezcla) setTimeout(() => labcin("Este PDF tiene páginas de distintos tamaños. Si querés, las paso todas a A4.", "tip",
        { texto: T("Pasar todo a A4"), fn: () => ajustarPaginas({ tamano: "a4", margen: 0, orientacion: "auto" }, true) }), 900);
      else if (!tipsDados.current.has("paginas") && !info.seguridad?.firma && !info.seguridad?.restringido) {
        tipsDados.current.add("paginas");
        setTimeout(() => labcin("En “Páginas” podés pasar todo a A4, ponerle márgenes, numerarlas o agregar una marca de agua.", "tip",
          { texto: T("Ver opciones"), fn: () => setMenuPaginas(true) }), 7000);
      }
    }).catch(() => {});
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
    const propietario = !!pidiendoClave?.propietario;
    const r = await motor.clave(clave);
    if ("incorrecta" in r) setPidiendoClave({ error: true, propietario });
    else if (propietario) {
      setPidiendoClave(null);
      const seg = (r as InfoDoc).seguridad ?? null;
      setSeguridad(seg);
      avisar(seg?.restringido ? T("Esa no es la contraseña de propietario.") : T("Listo: ya podés modificar este PDF."), seg?.restringido ? "error" : "ok");
    } else {
      listo(r);
      setAbiertoConClave(true);
      claveOriginal.current = clave;
      setTimeout(() => labcin("Este PDF tenía contraseña. Si lo vas a compartir con alguien de confianza, puedo guardarlo sin ella.", "tip",
        { texto: T("Guardar sin contraseña"), fn: () => { setGuardado({ quitarClave: true }); setCambios(true); avisar(T("Al guardar, el PDF queda sin contraseña."), "ok"); } }), 1200);
    }
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
    if (paso.tipo === "estructura") {
      try {
        const info = await motor.restaurar();
        setAnots({}); setSeleccion(null);
        setVersiones((v) => Object.fromEntries(info.paginas.map((_, i) => [i, (v[i] || 0) + 1])));
        setDoc(info);
      } catch { /* nada que deshacer */ }
      return;
    }
    try {
      if (paso.tipo === "crear") await motor.borrar(paso.pagina, paso.id);
      if (paso.tipo === "mover") await motor.mover(paso.pagina, paso.id, -paso.dx, -paso.dy);
      if (paso.tipo === "ajustar") await motor.ajustar(paso.pagina, paso.id, paso.r);
    } catch { /* la anotación ya no existe */ }
    setSeleccion(null);
    await recargar((paso as { pagina: number }).pagina);
  }

  async function borrarSeleccion() {
    if (!seleccion) return;
    const s = seleccion;
    setSeleccion(null);
    await motor.borrar(s.pagina, s.id);
    setHistorial((h) => h.filter((p) => p.tipo === "estructura" || !(p.pagina === s.pagina && p.id === s.id)));
    setCambios(true);
    await recargar(s.pagina);
  }

  // ---------- cambios en la estructura del documento (páginas, unir, marca de agua…) ----------
  // Se guarda una copia antes de un cambio grande, para poder deshacerlo.
  async function preparar() {
    if (!doc) return;
    try { await motor.instantanea(); setHistorial((h) => [...h, { tipo: "estructura" }]); } catch { /* sin copia */ }
  }

  function docCambio(info: InfoDoc, nombreNuevo?: string) {
    if (nombreNuevo) {
      reiniciar();
      setArchivo({ nombre: nombreNuevo });
      listo(info);
    } else {
      setAnots({}); setSeleccion(null);
      setVersiones((v) => Object.fromEntries(info.paginas.map((_, i) => [i, (v[i] || 0) + 1])));
      setDoc(info);
    }
    setCambios(true);
  }

  async function operarPagina(f: () => Promise<InfoDoc>) {
    if (bloqueado()) return;
    try { await preparar(); docCambio(await f()); }
    catch (e) { console.error(e); avisar(T("Algo salió mal. Probá de nuevo."), "error"); }
  }

  // ---------- tareas: "¿Qué querés hacer?" y el buscador ----------
  function conDocumento(f: () => void) {
    if (doc) return f();
    tareaPendiente.current = f;
    abrirConDialogo().then((a) => { if (a) cargar(a); else tareaPendiente.current = null; });
  }

  function tarea(id: string) {
    switch (id) {
      case "firmar": return conDocumento(() => elegirHerramienta("firma"));
      case "anotar": return conDocumento(() => elegirHerramienta("resaltar"));
      case "censurar": return conDocumento(() => elegirHerramienta("censurar"));
      case "escanear": return abrirEscaner();
      case "unir": return abrirRapida("unir");
      case "dividir": return abrirRapida("dividir");
      case "achicar": return abrirRapida("comprimir");
      case "proteger": return abrirRapida("clave");
      case "a4": return conDocumento(() => setAjustando(true));
      default: return setPanel({ inicial: null });
    }
  }

  const SINONIMOS: Record<string, string> = {
    firma: "firmar rubricar sign", resaltar: "marcar destacar", subrayar: "linea", tachar: "rayar", texto: "escribir agregar",
    recuadro: "cuadro rectangulo", dibujar: "lapiz mano alzada flecha circulo", censurar: "tapar ocultar dni cbu privado",
    seleccionar: "mover cursor", unir: "juntar combinar merge", dividir: "separar cortar partir split", extraer: "sacar copiar",
    comprimir: "achicar reducir peso liviano whatsapp mail", clave: "proteger contrasena candado seguridad password",
    marca: "sello borrador confidencial", numerar: "numero paginar", ajustar: "a4 tamano margenes carta",
    imagenes: "jpg png foto", limpiar: "privacidad metadatos autor", escanear: "camara foto escaner",
  };

  function comandos(): Comando[] {
    const lista: Comando[] = [];
    if (doc) for (const h of HERRAMIENTAS)
      lista.push({ id: "h-" + h.id, titulo: T(h.nombre), desc: T(h.ayuda), icono: h.icono, palabras: SINONIMOS[h.id], accion: () => elegirHerramienta(h.id) });
    for (const h of LISTA)
      lista.push({ id: "t-" + h.id, titulo: T(h.nombre), desc: T(h.desc), icono: h.icono, palabras: `${SINONIMOS[h.id] || ""} ${h.palabras || ""}`, deshabilitado: !doc && h.grupo === "editar",
        accion: () => (h.grupo === "rapida" ? abrirRapida(h.id) : h.id === "ajustar" ? (bloqueado() || setAjustando(true))
          : conDocumento(() => setPanel({ inicial: h.id }))) });
    lista.push(
      { id: "abrir", titulo: T("Abrir"), icono: FolderOpen, palabras: "pdf archivo", accion: () => abrirConDialogo().then(cargar) },
      { id: "tema-claro", titulo: T("Tema claro"), icono: Sun, palabras: "modo blanco dia luz apariencia", accion: () => cambiarTema("claro") },
      { id: "tema-oscuro", titulo: T("Tema oscuro"), icono: Moon, palabras: "modo negro noche dark apariencia", accion: () => cambiarTema("oscuro") },
      { id: "tema-auto", titulo: T("Tema automático"), desc: T("Igual que el sistema"), icono: SunMoon, palabras: "modo sistema apariencia", accion: () => cambiarTema("auto") },
      { id: "actualizar", titulo: T("Buscar actualizaciones"), desc: `Ozone PDF ${__VERSION__}`, icono: RefreshCw, palabras: "version nueva actualizar update", accion: () => buscarActualizaciones() },
      { id: "cerrar", titulo: T("Cerrar PDF"), desc: T("Volver al inicio"), icono: House, palabras: "salir menu inicio volver atras", deshabilitado: !doc, accion: () => cerrarDocumento() },
      { id: "guardar", titulo: T("Guardar"), icono: Save, palabras: "descargar exportar", deshabilitado: !doc, accion: () => guardar() },
      { id: "deshacer", titulo: T("Deshacer"), icono: Undo2, palabras: "volver atras", deshabilitado: !historial.length, accion: deshacer },
      { id: "a11y", titulo: T("Accesibilidad"), icono: Accessibility, palabras: "letra grande contraste voz movimiento", accion: () => setPanelA11y(true) },
    );
    return lista;
  }

  // ---------- páginas del mismo tamaño ----------
  async function ajustarPaginas(o: OpcionesAjuste, desdeLabcin = false) {
    setAjustando(false);
    if (bloqueado()) return;
    setOcupado(true);
    try {
      await preparar();
      const r = await motor.ajustarPaginas(o.tamano, o.margen, o.orientacion);
      const { cambiadas, ...info } = r;
      // el contenido de las páginas cambió: se vuelve a dibujar todo
      setAnots({}); setSeleccion(null);
      setVersiones((v) => Object.fromEntries(info.paginas.map((_, i) => [i, (v[i] || 0) + 1])));
      setDoc(info);
      if (cambiadas) {
        setCambios(true);
        if (desdeLabcin) labcin("¡Listo! Todas las páginas quedaron en A4.", "festejo");
        else avisar(T("Listo: {n} páginas ajustadas.", { n: cambiadas }), "ok");
        requestAnimationFrame(() => ajustarAncho(info));
      } else avisar(T("Las páginas ya tenían ese tamaño."));
    } catch (e) {
      console.error(e);
      avisar(T("No se pudo guardar."), "error");
    } finally {
      setOcupado(false);
    }
  }

  // ---------- escáner ----------
  function abrirEscaner() {
    if (!tipsDados.current.has("escaner")) {
      tipsDados.current.add("escaner");
      setTimeout(() => labcin("Apoyá la hoja sobre algo oscuro: así encuentro mejor los bordes. Elegí “Blanco y negro” para que quede como escáner."), 500);
    }
    setEscaner(true);
  }

  // al terminar algo, Labcin festeja; de vez en cuando (1 de cada 3) recuerda el cafecito
  function agradecer(texto: string) {
    let n = 0;
    try { n = Number(localStorage.getItem("ozone.terminados") || "0") + 1; localStorage.setItem("ozone.terminados", String(n)); } catch { /* nada */ }
    if (n % 3 === 1) labcin(T(texto) + " " + T("Si te sirvió, podés invitarme un cafecito ☕"), "festejo",
      { texto: T("Invitar un cafecito"), fn: () => abrirEnlace("https://cafecito.app/pachelabs") });
    else labcin(texto, "festejo");
  }

  async function buscarActualizaciones() {
    const origen = await origenInstalacion();
    if (origen === "play" || origen === "appstore") {
      labcin(T(origen === "play" ? "Tenés Ozone PDF {v}: se actualiza solo desde Google Play." : "Tenés Ozone PDF {v}: se actualiza solo desde la App Store.", { v: __VERSION__ }), "tip");
      return;
    }
    if (origen === "tienda") {
      labcin(T("Tenés Ozone PDF {v} de Microsoft Store: se actualiza solo, no tenés que hacer nada.", { v: __VERSION__ }), "tip");
      return;
    }
    abrirEnlace(paginaActualizaciones(idioma()));
    avisar(T("Abrí la página de descargas en tu navegador: ahí te dice si hay una versión nueva."));
  }

  // herramientas rápidas: pantalla propia; si hay un PDF abierto, se ofrece ese
  async function abrirRapida(id: IdHerramienta) {
    if (id === "escanear") return abrirEscaner();
    let inicial: Abierto | null = null;
    if (doc && archivo && id !== "img2pdf") {
      // con zonas para censurar sin aplicar, la copia saldría con los datos debajo: primero hay que guardar
      if (await motor.censurasPendientes().catch(() => 0) > 0) { avisar(T("Primero guardá el PDF para que se aplique la censura."), "error"); return; }
      try {
        const datos = !cambios && datosAbiertos.current ? datosAbiertos.current.slice(0) : (await motor.guardar(claveOriginal.current ? { clave: claveOriginal.current } : {})).datos.slice().buffer;
        inicial = { nombre: archivo.nombre, datos, ruta: archivo.ruta, clave: claveOriginal.current || undefined };
      } catch { /* sin PDF de partida */ }
    }
    setPanel(null); setMenuPaginas(false);
    setRapida({ id, inicial });
  }


  async function crearDesdeEscaneo(imagenes: Uint8Array[], anexar: boolean, reconocer = false, prefijo = T("Escaneo")) {
    if (!anexar && cambios && !window.confirm(T("Hay cambios sin guardar. ¿Abrir otro archivo igual?"))) return;
    if (anexar && doc && bloqueado()) return; // antes de cerrar el escáner, así no se pierden las fotos
    setEscaner(false);
    setOcupado(true);
    try {
      const antes = doc?.paginas.length || 0;
      if (anexar && doc) { if (bloqueado()) return; await preparar(); }
      const info = await motor.desdeImagenes(imagenes, anexar && !!doc);
      // como CamScanner: el texto de las fotos queda buscable y se puede copiar (OCR, sin internet)
      if (reconocer) {
        const desde = anexar && doc ? antes : 0, total = info.paginas.length;
        try {
          const { capaDeTexto, ocrDeLaApp } = await import("./ocr");
          for (let i = desde; i < total; i++) {
            avisar(T("Reconociendo el texto: página {n} de {total}…", { n: i - desde + 1, total: total - desde }));
            const pg = await motor.paginaParaOcr(i, 300);
            if (pg.conTexto) continue;
            const capa = await capaDeTexto(pg.png, pg.dpi, ocrDeLaApp(idioma()));
            if (capa.palabras) await motor.agregarCapaTexto(i, capa.pdf);
          }
          avisar(T("Listo: el texto del escaneo se puede buscar y copiar."), "ok");
        } catch (e) {
          console.error(e);
          avisar(T("No se pudo reconocer el texto, pero el PDF se creó igual."), "error");
        }
      }
      if (anexar && doc) {
        setDoc(info);
        setCambios(true);
        setTimeout(() => irA(antes), 300);
      } else {
        const hoy = new Date().toISOString().slice(0, 10);
        setArchivo({ nombre: `${prefijo} ${hoy}.pdf` });
        reiniciar();
        listo(info);
        setCambios(true);
      }
    } catch (e) {
      console.error(e);
      avisar(T("No se pudo guardar."), "error");
    } finally {
      setOcupado(false);
    }
  }

  // ---------- guardar ----------
  async function guardar(censurarYa = false) {
    if (!doc || !archivo) return;
    if (bloqueado()) { cerrarDespues.current = false; return; }
    const pendientes = await motor.censurasPendientes().catch(() => -1);
    if (pendientes < 0) { cerrarDespues.current = false; avisar(T("No se pudo guardar."), "error"); return; }
    if (pendientes > 0 && !censurarYa) return setConfirmarCensura(pendientes);
    setConfirmarCensura(null);
    setOcupado(true);
    try {
      if (pendientes > 0) {
        const cambiadas = await motor.aplicarCensura();
        for (const i of cambiadas) await recargar(i);
        // la censura no se puede deshacer: se olvida el historial
        setHistorial([]);
        motor.olvidarInstantaneas().catch(() => {});
      }
      // si se abrió con contraseña y no se pidió quitarla, se vuelve a guardar con la misma
      const opciones = guardado.clave || guardado.quitarClave || !claveOriginal.current ? guardado : { clave: claveOriginal.current };
      const { datos } = await motor.guardar(opciones);
      const copia = datos.slice().buffer;
      const ok = await guardarConDialogo(datos, archivo.nombre, archivo.ruta);
      if (ok) {
        // lo guardado pasa a ser "el PDF abierto": las herramientas rápidas parten de acá (con la censura aplicada)
        datosAbiertos.current = copia;
        tamanoAbierto.current = copia.byteLength;
        setCambios(false);
        avisar(T("Guardado ✓"), "ok");
        if (cerrarDespues.current) { cerrarDespues.current = false; cerrarDocumento(true); }
        else agradecer("¡Listo! Tu PDF quedó guardado.");
      } else cerrarDespues.current = false;
    } catch (e) {
      cerrarDespues.current = false;
      console.error(e);
      avisar(T("No se pudo guardar."), "error");
    } finally {
      setOcupado(false);
    }
  }

  // ---------- cerrar el PDF y volver al inicio ----------
  function cerrarDocumento(forzar = false) {
    if (!doc && !archivo) return;
    if (cambios && !forzar) { setPreguntaCerrar(true); return; }
    setPreguntaCerrar(false);
    setPanel(null); setHerramienta("seleccionar"); setConfirmarCensura(null);
    reiniciar();
    setDoc(null); setArchivo(null);
    motor.olvidarInstantaneas().catch(() => {});
  }

  // Labcin saluda al abrir la app
  useEffect(() => {
    // si ya se abrió un PDF (por ejemplo con "Abrir con…"), saluda sin pedir que abras uno
    const t = setTimeout(() => labcin(tipsDados.current.has("abrir")
      ? "Elegí una herramienta de arriba. Si te equivocás, Ctrl+Z deshace."
      : "¡Hola, soy Labcin! Abrí un PDF y te voy dando tips.", "saludo",
      { texto: T("Opciones de accesibilidad"), fn: () => setPanelA11y(true) }), intro && !a11y.movimiento ? 2900 : 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labcin]);

  // abrir el PDF con el que se lanzó la app ("Abrir con… Ozone PDF")
  useEffect(() => {
    archivoInicial().then((a) => a && cargar(a)).catch(() => {});
    // en el celular: un PDF compartido desde otra app mientras Ozone PDF ya estaba abierto
    alLlegarArchivo(() => archivoInicial().then((a) => a && cargarRef.current(a)).catch(() => {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- atajos de teclado ----------
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const escribiendo = (e.target as HTMLElement)?.closest("textarea, input");
      const mod = e.ctrlKey || e.metaKey;
      if (e.altKey && !mod && e.key.toLowerCase() === "a") { e.preventDefault(); setPanelA11y((v) => !v); }
      else if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setPaleta((v) => !v); }
      else if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); abrirConDialogo().then(cargar); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); guardar(); }
      else if (mod && e.key.toLowerCase() === "w" && doc) { e.preventDefault(); cerrarDocumento(); }
      else if (escribiendo) return;
      // en una herramienta rápida el editor está oculto: deshacer o borrar ahí cambiaría el PDF sin que se vea
      else if (rapida && e.key !== "Escape") return;
      else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); deshacer(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && seleccion) { e.preventDefault(); borrarSeleccion(); }
      else if (e.key === "Escape") {
        if (ajustes) setAjustes(false);
        else if (menuPaginas) setMenuPaginas(false);
        else if (rapida && !panel && !panelA11y) { if (!ocupado) setRapida(null); } // mientras trabaja, no se sale
        else if (panel || panelA11y || ajustando || confirmarCensura !== null) { setPanel(null); setPanelA11y(false); setAjustando(false); setConfirmarCensura(null); }
        else { setSeleccion(null); setHerramienta("seleccionar"); }
      }
      else if (mod && (e.key === "+" || e.key === "=")) { e.preventDefault(); setZoom((z) => Math.min(z * 1.2, 5)); }
      else if (mod && e.key === "-") { e.preventDefault(); setZoom((z) => Math.max(z / 1.2, 0.2)); }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  // al abrir una ventana, el foco va a su primer control (para teclado y lectores de pantalla)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const modales = document.querySelectorAll<HTMLElement>(".modal");
      const m = modales[modales.length - 1];
      if (!m || m.contains(document.activeElement)) return;
      m.querySelector<HTMLElement>("[autofocus], input, select, textarea, button:not([disabled])")?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [panel, panelA11y, ajustando, confirmarCensura, modalFirma, pidiendoClave]);

  // el marco rojo de "soltá el archivo" se apaga siempre al soltar o cancelar, caiga donde caiga
  useEffect(() => {
    const apagar = () => setArrastrandoArchivo(false);
    window.addEventListener("drop", apagar, true);
    window.addEventListener("dragend", apagar, true);
    return () => { window.removeEventListener("drop", apagar, true); window.removeEventListener("dragend", apagar, true); };
  }, []);

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
    if (h !== "seleccionar" && bloqueado()) return;
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
      onDragOver={(e) => { e.preventDefault(); if (!rapida && e.dataTransfer.types.includes("Files")) setArrastrandoArchivo(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastrandoArchivo(false); }}
      onDrop={async (e) => {
        e.preventDefault();
        setArrastrandoArchivo(false);
        if (rapida) return; // la pantalla de la herramienta recibe sus propios archivos
        const f = [...e.dataTransfer.files].find((x) => /\.pdf$/i.test(x.name) || x.type === "application/pdf");
        if (f) cargar(await desdeArchivo(f));
      }}
    >
      <header className="barra">
        <div className="marca">
          <button type="button" className="marca__volver" onClick={() => cerrarDocumento()} disabled={!doc}
            title={doc ? T("Volver al inicio") : undefined} aria-label={doc ? T("Volver al inicio") : "Ozone PDF"}>
          <img className="marca__logo" src="/img/marca.png" alt="" width={34} height={34} />
          <div className="marca__texto">
            <strong>Ozone PDF</strong>
            <span className="marca__archivo" title={archivo?.nombre}>
              {archivo ? archivo.nombre + (cambios ? " •" : "") : <>Pache<span className="marca__punto">.</span>Labs</>}
              {guardado.clave && <Lock size={12} className="marca__candado" aria-label={T("Al guardar, el PDF queda con contraseña.")} />}
              {seguridad?.firma && <BadgeCheck size={13} className="marca__candado" aria-label={T("Con firma digital")} />}
              {seguridad?.restringido && <ShieldAlert size={13} className="marca__candado" aria-label={T("Con restricciones")} />}
            </span>
          </div>
          </button>
          {doc && (
            <button type="button" className="marca__cerrar" onClick={() => cerrarDocumento()} title={T("Cerrar PDF") + " (Ctrl+W)"} aria-label={T("Cerrar PDF")}>
              <X size={17} />
            </button>
          )}
        </div>
        <div className="barra__acciones">
          <button className="icono icono--barra" onClick={() => setPaleta(true)} title={T("Buscar herramienta") + " (Ctrl+K)"} aria-label={T("Buscar herramienta")}>
            <Search size={19} />
          </button>
          <button className="boton boton--suave solo-celular" onClick={() => setAjustes((v) => !v)} aria-expanded={ajustes}
            title={T("Ajustes")} aria-label={T("Ajustes")}>
            <Settings size={18} aria-hidden />
          </button>
          <button className="icono icono--barra tema-btn solo-compu" onClick={() => cambiarTema()}
            title={T("Tema: {t}", { t: T(NOMBRE_TEMA[tema]) }) + " — " + T("tocá para cambiar")} aria-label={T("Tema: {t}", { t: T(NOMBRE_TEMA[tema]) })}>
            {tema === "claro" ? <Sun size={19} /> : tema === "oscuro" ? <Moon size={19} /> : <SunMoon size={19} />}
            {tema === "auto" && <span className="tema-btn__letra" aria-hidden>A</span>}
          </button>
          <button className="icono icono--barra solo-compu" onClick={() => setPanelA11y(true)} title={T("Accesibilidad") + " (Alt+A)"} aria-label={T("Accesibilidad")}>
            <Accessibility size={20} />
          </button>
          <label className="idioma solo-compu" title={T("Idioma")}>
            <Languages size={17} aria-hidden />
            <select
              value={idioma()}
              aria-label={T("Idioma")}
              onChange={(e) => { cambiarIdioma(e.target.value as Idioma); refrescarIdioma(e.target.value as Idioma); }}
            >
              {IDIOMAS.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </label>
          <button className="boton boton--suave" onClick={() => setPanel({ inicial: null })} title={T("Herramientas")}>
            <LayoutGrid size={18} aria-hidden /> <span>{T("Herramientas")}</span>
          </button>
          <button className="boton boton--suave" onClick={() => abrirConDialogo().then(cargar)}>
            <FolderOpen size={18} aria-hidden /> <span>{T("Abrir")}</span>
          </button>
          <button className="boton boton--primario" onClick={() => guardar()} disabled={!doc || ocupado}>
            <Save size={18} aria-hidden /> <span>{T("Guardar")}</span>
          </button>
        </div>
      </header>

      {ajustes && (
        <div className="ajustes__fondo" onClick={() => setAjustes(false)}>
          <div className="ajustes" role="dialog" aria-label={T("Ajustes")} onClick={(e) => e.stopPropagation()}>
            <label className="ajustes__fila">
              <span><Languages size={18} aria-hidden /> {T("Idioma")}</span>
              <select className="campo" value={idioma()}
                onChange={(e) => { cambiarIdioma(e.target.value as Idioma); refrescarIdioma(e.target.value as Idioma); }}>
                {IDIOMAS.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </label>
            <div className="ajustes__fila">
              <span>{tema === "oscuro" ? <Moon size={18} aria-hidden /> : <Sun size={18} aria-hidden />} {T("Tema")}</span>
              <div className="segmentos" role="radiogroup" aria-label={T("Tema")}>
                {(["claro", "oscuro", "auto"] as Tema[]).map((x) => (
                  <label key={x}>
                    <input type="radio" name="tema-celular" checked={tema === x} onChange={() => cambiarTema(x)} />
                    <span>{T(NOMBRE_TEMA[x])}</span>
                  </label>
                ))}
              </div>
            </div>
            <button className="ajustes__boton" onClick={() => { setAjustes(false); setPanelA11y(true); }}>
              <Accessibility size={18} aria-hidden /> {T("Accesibilidad")}
            </button>
            <button className="ajustes__boton" onClick={() => { setAjustes(false); buscarActualizaciones(); }}>
              <RefreshCw size={18} aria-hidden /> {T("Buscar actualizaciones")} <small>v{__VERSION__}</small>
            </button>
          </div>
        </div>
      )}

      {doc && !rapida && (
        <div className="herramientas" role="toolbar" aria-label={T("Herramientas")}>
          <Carril className="herramientas__grupo herramientas__lista">
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
            <div className="herramientas__paginas">
              <button className={"herr" + (menuPaginas ? " herr--activa" : "")} aria-haspopup="menu" aria-expanded={menuPaginas}
                onClick={() => setMenuPaginas((v) => !v)} title={T("Ajustar, numerar y marca de agua")}>
                <Files size={19} aria-hidden />
                <span>{T("Páginas")} <ChevronDown size={12} aria-hidden className="herr__flecha" /></span>
              </button>
              {menuPaginas && (
                <>
                  <div className="menu-capa" onPointerDown={() => setMenuPaginas(false)} />
                  <div className="menu-paginas" role="menu">
                    {/* en el celular no se ven las miniaturas: rotar, borrar y ordenar también van acá */}
                    {([
                      ["rotar", RotateCw, "Rotar páginas", "Girá todas o solo algunas."],
                      ["eliminar", Trash2, "Eliminar páginas", "Quitá las páginas que no querés."],
                      ["ordenar", ArrowDownUp, "Ordenar páginas", "Cambiá el orden o invertilo."],
                    ] as const).map(([id, I, t, d]) => (
                      <button key={id} role="menuitem" className="menu-paginas__item solo-celular" onClick={() => {
                        setMenuPaginas(false);
                        if (bloqueado()) return;
                        setPanel({ inicial: id });
                      }}>
                        <span className="tarjeta__icono"><I size={18} aria-hidden /></span>
                        <span><strong>{T(t)}</strong><small>{T(d)}</small></span>
                      </button>
                    ))}
                    {([
                      ["ajustar", Scaling, "Ajustar páginas", "A4, Carta, márgenes o todas verticales"],
                      ["numerar", ListOrdered, "Numerar páginas", "Agregá el número de página."],
                      ["marca", Stamp, "Marca de agua", "Un texto de fondo en cada página."],
                    ] as const).map(([id, I, t, d]) => (
                      <button key={id} role="menuitem" className="menu-paginas__item" onClick={() => {
                        setMenuPaginas(false);
                        if (bloqueado()) return;
                        if (id === "ajustar") setAjustando(true); else setPanel({ inicial: id });
                      }}>
                        <span className="tarjeta__icono"><I size={18} aria-hidden /></span>
                        <span><strong>{T(t)}</strong><small>{T(d)}</small></span>
                      </button>
                    ))}
                    <p className="menu-paginas__pie solo-compu">{T("Para rotar, borrar u ordenar, usá las miniaturas de la izquierda.")}</p>
                  </div>
                </>
              )}
            </div>
          </Carril>
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
            <button className="icono" onClick={() => setAjustando(true)} title={T("Ajustar páginas")} aria-label={T("Ajustar páginas")}>
              <Scaling size={18} />
            </button>
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
        {doc && !rapida && (
          <Miniaturas
            paginas={doc.paginas} versiones={versiones} actual={actual} alElegir={irA}
            alRotar={(i, g) => operarPagina(() => motor.rotarPagina(i, g))}
            alBorrar={(i) => operarPagina(() => motor.borrarPaginas([i]))}
            alMover={(de, a) => operarPagina(() => motor.moverPagina(de, a))}
          />
        )}
        <div className="vista" ref={vista} onScroll={alDesplazar}>
          {rapida ? (
            <Rapida key={rapida.id} id={rapida.id} inicial={rapida.inicial} alAviso={avisar} alOcupado={setOcupado}
              alVolver={() => setRapida(null)}
              alAbrirResultado={(a) => { setRapida(null); cargar(a); }}
              alTerminado={(t) => agradecer(t)} />
          ) : doc ? (
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
            <Inicio alAbrir={() => abrirConDialogo().then(cargar)} alEscanear={abrirEscaner} alTarea={tarea} alActualizar={buscarActualizaciones} />
          )}
        </div>
      </main>

      {doc && !rapida && <div className="contador">{actual + 1} / {doc.paginas.length}</div>}

      {modalFirma && (
        <FirmaModal
          alCerrar={(f) => {
            setModalFirma(false);
            if (f) { setFirma(f); setHerramienta("firma"); }
            else if (!firma) setHerramienta("seleccionar");
          }}
        />
      )}

      {pidiendoClave && <ModalClave error={!!pidiendoClave.error} alProbar={probarClave} propietario={!!pidiendoClave.propietario}
        alCancelar={() => { const prop = pidiendoClave.propietario; setPidiendoClave(null); if (!prop) setArchivo(null); }} />}

      {avisoSeguridad && (
        <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="titulo-seg">
          <div className="modal__caja modal__caja--seguridad">
            {avisoSeguridad.restringido ? (
              <>
                <h2 id="titulo-seg"><ShieldAlert size={22} aria-hidden /> {T("Este PDF tiene restricciones")}</h2>
                <p>{T("Su autor no permite modificarlo. Lo podés ver, pero no anotarlo, firmarlo, unirlo ni cambiarle páginas.")}</p>
                <p className="modal__ayuda">{avisoSeguridad.permisos.copiar && avisoSeguridad.permisos.imprimir ? T("Sí podés copiar el texto e imprimirlo.")
                  : avisoSeguridad.permisos.copiar ? T("Sí podés copiar el texto.") : avisoSeguridad.permisos.imprimir ? T("Sí podés imprimirlo.") : ""}
                  {" "}{T("Para quitar las restricciones hace falta la contraseña de propietario.")}</p>
              </>
            ) : avisoSeguridad.firma === "valida" ? (
              <>
                <h2 id="titulo-seg"><BadgeCheck size={22} aria-hidden /> {T("Este PDF tiene firma digital")}</h2>
                <p>{T("Podés verlo y usar las herramientas, pero el archivo que guardes NO va a tener una firma válida: cualquier cambio la invalida (en Acrobat aparece como alterada), y al unir o extraer páginas se pierde.")}</p>
                <p className="modal__ayuda">{T("El original no se modifica y sigue firmado: para trámites o para mandarlo como documento firmado, usá siempre el original.")}</p>
              </>
            ) : (
              <>
                <h2 id="titulo-seg"><ShieldAlert size={22} aria-hidden /> {T("La firma digital ya no es válida")}</h2>
                <p>{T("Este PDF tiene una firma digital, pero el archivo se modificó después de firmarse (por ejemplo, es una copia unida o comprimida). Aunque se vea el sello de la firma, no sirve como documento firmado.")}</p>
                <p className="modal__ayuda">{T("Si necesitás el documento firmado, pedí el original a quien lo firmó.")}</p>
              </>
            )}
            <div className="modal__botones">
              {avisoSeguridad.restringido && <button className="boton boton--suave" onClick={() => { setAvisoSeguridad(null); setPidiendoClave({ propietario: true }); }}>{T("Tengo la contraseña")}</button>}
              <span className="espacio" />
              <button className="boton boton--primario" autoFocus onClick={() => setAvisoSeguridad(null)}>{T("Entendido")}</button>
            </div>
          </div>
        </div>
      )}

      {preguntaCerrar && (
        <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="titulo-cerrar" onPointerDown={(e) => e.target === e.currentTarget && setPreguntaCerrar(false)}>
          <div className="modal__caja">
            <h2 id="titulo-cerrar">{T("¿Guardar los cambios?")}</h2>
            <p>{T("Hiciste cambios en “{n}”. Si cerrás sin guardar, se pierden.", { n: archivo?.nombre || "" })}</p>
            <div className="modal__botones">
              <button className="boton boton--suave" onClick={() => setPreguntaCerrar(false)}>{T("Cancelar")}</button>
              <span className="espacio" />
              <button className="boton boton--suave" onClick={() => cerrarDocumento(true)}>{T("Cerrar sin guardar")}</button>
              <button className="boton boton--primario" autoFocus onClick={() => { setPreguntaCerrar(false); cerrarDespues.current = true; guardar(); }}>{T("Guardar")}</button>
            </div>
          </div>
        </div>
      )}

      {confirmarCensura !== null && (
        <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="titulo-censura">
          <div className="modal__caja">
            <h2 id="titulo-censura"><EyeOff size={20} aria-hidden /> {T("Censura definitiva")}</h2>
            <p>{T("Hay {n} zonas marcadas para censurar. Al guardar, el texto, las imágenes y los dibujos que estén debajo se borran del archivo y no se pueden recuperar.", { n: confirmarCensura })}</p>
            <div className="modal__botones">
              <span className="espacio" />
              <button className="boton boton--suave" onClick={() => { cerrarDespues.current = false; setConfirmarCensura(null); }}>{T("Cancelar")}</button>
              <button className="boton boton--peligro" onClick={() => guardar(true)}>{T("Censurar y guardar")}</button>
            </div>
          </div>
        </div>
      )}

      {panel && (
        <Herramientas
          doc={doc} nombre={archivo?.nombre || "documento.pdf"} ruta={archivo?.ruta}
          abiertoConClave={abiertoConClave} guardado={guardado} inicial={panel.inicial}
          alCerrar={() => setPanel(null)}
          alCambiarDoc={docCambio}
          alPreparar={preparar}
          alGuardado={(o) => { setGuardado(o); setCambios(true); }}
          alAviso={avisar}
          alEscanear={abrirEscaner}
          alAjustar={() => setAjustando(true)}
          alOcupado={setOcupado}
          alConArchivo={(id) => conDocumento(() => setPanel({ inicial: id }))}
          seguridad={seguridad}
          alBloqueado={() => seguridad && setAvisoSeguridad(seguridad)}
          alRapida={abrirRapida}
          alRecargar={(info) => {
            setAnots({}); setSeleccion(null);
            setVersiones((v) => Object.fromEntries(info.paginas.map((_, i) => [i, (v[i] || 0) + 1])));
            setDoc(info);
          }}
        />
      )}
      {escaner && <Escaner hayDocumento={!!doc} alCerrar={() => setEscaner(false)} alCrear={(im, an, rec) => crearDesdeEscaneo(im, an, rec)} />}
      {ajustando && <AjustarPaginas alAceptar={(o) => ajustarPaginas(o)} alCancelar={() => setAjustando(false)} />}

      {paleta && <Paleta comandos={comandos()} alCerrar={() => setPaleta(false)} />}
      {panelA11y && <AccesibilidadPanel valor={a11y} alCambiar={cambiarA11y} alCerrar={() => setPanelA11y(false)} />}

      <Labcin evento={eventoLabcin} voz={a11y.voz} />

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

const NOMBRE_TEMA: Record<Tema, string> = { auto: "Automático", claro: "Claro", oscuro: "Oscuro" };

type Tarea = { id: string; icono: typeof Type; titulo: string };
// ordenadas de la más usada a la menos usada
const RAPIDAS: Tarea[] = [
  { id: "unir", icono: Combine, titulo: "Unir varios PDF" },
  { id: "dividir", icono: Scissors, titulo: "Dividir un PDF" },
  { id: "achicar", icono: Minimize2, titulo: "Achicar para mandar" },
  { id: "escanear", icono: Camera, titulo: "Escanear con la cámara" },
  { id: "proteger", icono: Lock, titulo: "Proteger con contraseña" },
  { id: "todas", icono: LayoutGrid, titulo: "Ver todas las herramientas" },
];
const EDITAR: Tarea[] = [
  { id: "firmar", icono: Signature, titulo: "Firmar un documento" },
  { id: "anotar", icono: Highlighter, titulo: "Resaltar y anotar" },
  { id: "censurar", icono: EyeOff, titulo: "Tapar datos privados" },
];

function Inicio({ alAbrir, alEscanear, alTarea, alActualizar }: { alAbrir: () => void; alEscanear: () => void; alTarea: (id: string) => void; alActualizar: () => void }) {
  const titulo = T("Abrí un PDF para empezar");
  const celular = window.matchMedia("(max-width: 760px)").matches;
  return (
    <section className="inicio inicio--tareas">
      <div className="inicio__zona">
        <img src="/img/intro-avatar-solo.png" alt="" width={112} height={112} className="inicio__avatar" />
        <h1>{titulo}<span>.</span></h1>
        <p>{celular
          ? T("Tocá «Escanear» o «Elegir PDF». Tus archivos nunca salen de tu equipo.")
          : T("Arrastralo acá o tocá “Abrir”. Tus archivos nunca salen de tu equipo.")}</p>
        <div className="inicio__botones">
          {/* en el celular lo más usado es escanear: va primero y en rojo */}
          {celular && <button className="boton boton--primario boton--grande" onClick={alEscanear}>
            <Camera size={20} aria-hidden /> {T("Escanear")}
          </button>}
          <button className={"boton boton--grande " + (celular ? "boton--suave" : "boton--primario")} onClick={alAbrir}>
            <FolderOpen size={20} aria-hidden /> {T("Elegir PDF")}
          </button>
          {!celular && <button className="boton boton--suave boton--grande" onClick={alEscanear}>
            <Camera size={20} aria-hidden /> {T("Escanear")}
          </button>}
        </div>
      </div>
      {([["Herramientas rápidas", "Te dan un archivo nuevo, sin tocar el original.", RAPIDAS], ["Editar un PDF", "Abrilo y trabajá sobre él.", EDITAR]] as const).map(([titulo, ayuda, lista], g) => (
        <div key={titulo} className="inicio__grupo">
          <h2 className="inicio__pregunta">{T(titulo)} <small>{T(ayuda)}</small></h2>
          <ul className="tareas">
            {lista.map((t, i) => {
              const I = t.icono;
              return (
                <li key={t.id} style={{ animationDelay: `${0.3 + (g * 6 + i) * 0.04}s` }}>
                  <button className="tarea" onClick={() => alTarea(t.id)}>
                    <span className="tarea__icono"><I size={22} aria-hidden /></span>
                    <span>{T(t.titulo)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="inicio__sello"><ShieldCheck size={16} aria-hidden /> {T("Sin conexión · Nada sale de tu equipo")}{!celular && <> · <kbd>Ctrl</kbd>+<kbd>K</kbd> {T("para buscar")}</>}</p>
      <footer className="inicio__pie">
        <span>{T("Ozone PDF es gratis y de código abierto. Hecho por")} <strong>Nicolás Pacheco</strong> · <a href="https://pachelabs.net" onClick={(e) => { e.preventDefault(); abrirEnlace("https://pachelabs.net"); }}>Pache<span className="marca__punto">.</span>Labs</a> · {T("Argentina")}</span>
        <a className="inicio__cafecito" href="https://cafecito.app/pachelabs" onClick={(e) => { e.preventDefault(); abrirEnlace("https://cafecito.app/pachelabs"); }}>
          <Coffee size={16} aria-hidden /> {T("Invitame un cafecito")}
        </a>
        <button type="button" className="inicio__version" onClick={alActualizar} title={T("Buscar actualizaciones")}>
          <RefreshCw size={14} aria-hidden /> v{__VERSION__} · {T("Buscar actualizaciones")}
        </button>
      </footer>
    </section>
  );
}

function ModalClave(p: { error: boolean; propietario?: boolean; alProbar: (c: string) => void; alCancelar: () => void }) {
  const [clave, setClave] = useState("");
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-clave">
      <form className="modal__caja" onSubmit={(e) => { e.preventDefault(); p.alProbar(clave); }}>
        <h2 id="titulo-clave">{T(p.propietario ? "Contraseña de propietario" : "Este PDF tiene contraseña")}</h2>
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
