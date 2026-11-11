import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, ArrowDown, X, FilePlus2, CheckCircle2, ShieldAlert, BadgeCheck, Lock, FileText, Copy, Download, Info } from "lucide-react";
import { T, idioma } from "../i18n";
import { IDIOMAS_OCR, ocrDeLaApp, leerTexto, capaDeTexto, alAvanzar, type IdiomaOcr } from "../ocr";
import { prepararImagen } from "../imagenes";
import { motorAparte, type Seguridad } from "../motor/motor";
import { LISTA, type IdHerramienta } from "./Herramientas";
import { abrirEnlace, abrirVarios, abrirConDialogo, abrirImagenes, abrirWord, guardarArchivo, guardarVarios, base, type Abierto } from "../archivos";
import { wordAHtml, armarDocx, type Hoja } from "../word";

// Herramientas rápidas, como en Ozone PDF clásico: una pantalla propia donde se eligen o se sueltan
// los archivos, se ven en una lista, se eligen las opciones y se genera un archivo nuevo.
// Usan un motor aparte, así nunca tocan el PDF abierto en el editor. El original no se modifica.

type Archivo = {
  id: number; nombre: string; datos: Uint8Array; ruta?: string; tamano: number;
  paginas?: number; seguridad?: Seguridad; necesitaClave?: boolean; clave?: string; error?: string; imagen?: boolean; word?: boolean;
  tipoError?: TipoError; // para explicar el problema al tocar la etiqueta
};
type TipoError = "abrir" | "word" | "imagen" | "clave";
// Lo que se explica al tocar una etiqueta de un archivo (firma, permisos o un error).
type Tema = "firma" | "firmaAlterada" | "permisos" | TipoError;
const EXPLICACION: Record<Tema, { titulo: string; texto: string[] }> = {
  firma: { titulo: "Este PDF tiene firma digital", texto: [
    "Podés usarlo en esta herramienta, pero el archivo nuevo no va a tener una firma válida: cualquier cambio (unir, cortar, comprimir) la invalida.",
    "El original no se modifica y sigue firmado. Para trámites que piden el documento firmado, presentá el original.",
  ] },
  firmaAlterada: { titulo: "La firma digital ya no es válida", texto: [
    "El PDF tiene una firma, pero el archivo se cambió después de firmarse (por ejemplo, es una copia unida o comprimida). Aunque se vea el sello, no sirve como documento firmado.",
    "Si necesitás el documento firmado, pedile el original a quien lo firmó.",
  ] },
  permisos: { titulo: "Permisos del autor", texto: [
    "Quien hizo este PDF marcó que no se modifique. No es una contraseña para abrirlo: se puede leer igual. Es un pedido que cada programa decide si respeta.",
    "Si tenés la contraseña de permisos (también llamada de propietario), escribila y se quitan.",
    "Si no la tenés, tocá «Usarlo igual», siempre que tengas derecho a usarlo así: por ejemplo, es tuyo o lo necesitás para un trámite.",
  ] },
  abrir: { titulo: "No se pudo abrir el archivo", texto: [
    "Puede estar dañado, incompleto (por ejemplo, una descarga que se cortó) o no ser un PDF aunque el nombre termine en .pdf.",
    "Probá abrirlo con otro programa. Si tampoco abre, pedí el archivo de nuevo o descargalo otra vez.",
  ] },
  word: { titulo: "No es un documento .docx", texto: [
    "Ozone convierte los documentos de Word nuevos (.docx, de Word 2007 en adelante). Los .doc de Word 97-2003 usan otro formato que no se puede leer.",
    "Abrilo en Word, LibreOffice o Google Docs y guardalo como .docx («Guardar como» → Documento de Word). Después volvé a cargarlo.",
  ] },
  imagen: { titulo: "No es una imagen que se pueda leer", texto: [
    "Se pueden usar fotos JPG, PNG, WebP, GIF y BMP. Las fotos HEIC del iPhone no siempre se pueden leer.",
    "Si es una foto del iPhone, compartila como JPG (o cambiá en Ajustes → Cámara → Formatos → «Más compatible») y probá de nuevo.",
  ] },
  clave: { titulo: "Contraseña incorrecta", texto: [
    "La contraseña no coincide. Revisá mayúsculas y minúsculas, y que no haya espacios de más.",
    "Si no la sabés, pedísela a quien te mandó el archivo: sin ella no se puede abrir.",
  ] },
};

type Resultado = { texto: string; pdf?: { nombre: string; datos: Uint8Array; ruta?: string }; leido?: string };

const VARIOS = new Set<IdHerramienta>(["unir", "img2pdf", "ocrimg", "word2pdf"]);
const SOLO_LEER: Partial<Record<IdHerramienta, "copiar" | "imprimir">> = { texto: "copiar", imagenes: "imprimir", pdf2word: "copiar" };
const CLAVE_ABRIR = "ozone.abrirAlTerminar";

function tam(b: number) {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".0", "")} MB`;
}
let siguiente = 1;

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

export default function Rapida(p: {
  id: IdHerramienta;
  inicial?: Abierto | null;              // el PDF abierto en el editor, si había uno
  alVolver: () => void;
  alAbrirResultado: (a: Abierto) => void;
  alAviso: (t: string, tipo?: "ok" | "error") => void;
  alOcupado: (b: boolean) => void;
  alTerminado: (texto: string) => void;
}) {
  const h = LISTA.find((x) => x.id === p.id)!;
  const varios = VARIOS.has(p.id);
  const esImagen = p.id === "img2pdf" || p.id === "ocrimg";
  const esWord = p.id === "word2pdf";
  const noPdf = esImagen || esWord; // herramientas que reciben otra cosa que un PDF
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [soltando, setSoltando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [abrirAlTerminar, setAbrirAlTerminar] = useState(() => { try { return localStorage.getItem(CLAVE_ABRIR) !== "0"; } catch { return true; } });
  // opciones de cada herramienta
  const [modo, setModo] = useState<"cada" | "rangos" | "tamano">("cada");
  const [rangos, setRangos] = useState("");
  const [mbOpcion, setMbOpcion] = useState<number | "otro">(5);
  const [mbTexto, setMbTexto] = useState("");
  const mbNum = Number(mbTexto.replace(",", "."));
  const mbValido = Number.isFinite(mbNum) && mbNum >= 0.1 && mbNum <= 2000;
  const mb = mbOpcion === "otro" ? (mbValido ? mbNum : 0) : mbOpcion;
  const [nivel, setNivel] = useState("equilibrada");
  const [c1, setC1] = useState(""); const [c2, setC2] = useState("");
  const [formato, setFormato] = useState("jpg");
  const [dpi, setDpi] = useState(150);
  const [hoja, setHoja] = useState<Hoja>(() => (idioma() === "en" ? "carta" : "a4"));
  const [idiomaOcr, setIdiomaOcr] = useState<IdiomaOcr>(() => ocrDeLaApp(idioma()));
  const [trabajando, setTrabajando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [porcentaje, setPorcentaje] = useState(0);
  const listo = useRef(false);
  const [arrastrando, setArrastrando] = useState<number | null>(null); // id de la tarjeta que se está moviendo
  // PDF con permisos del autor que el usuario decidió usar igual (ver usarIgual)
  const [aceptados, setAceptados] = useState<Set<number>>(() => new Set());
  const [explicando, setExplicando] = useState<{ tema: Tema; archivo: Archivo } | null>(null);

  // revisa cada PDF al agregarlo: páginas, contraseña, firma y restricciones
  async function revisar(a: Archivo): Promise<Archivo> {
    if (a.word) {
      // un .docx es un .zip ("PK"); los .doc viejos de Word 97-2003 no se pueden leer
      if (a.datos[0] === 0x50 && a.datos[1] === 0x4b) return a;
      return { ...a, error: T("Solo se pueden convertir archivos .docx. Si es un .doc viejo, abrilo en Word y guardalo como .docx."), tipoError: "word" };
    }
    if (a.imagen) {
      try { (await createImageBitmap(new Blob([a.datos as BlobPart]))).close(); return a; }
      catch { return { ...a, error: T("No es una imagen que se pueda leer (JPG, PNG…)."), tipoError: "imagen" }; }
    }
    const m = motorAparte();
    try {
      await m.cerrar();
      const r = await m.abrir(a.datos.slice().buffer);
      if ("necesitaClave" in r) return { ...a, necesitaClave: true };
      return { ...a, paginas: r.paginas.length, seguridad: r.seguridad };
    } catch {
      return { ...a, error: T("No se pudo abrir. Verificá que sea un PDF válido."), tipoError: "abrir" };
    }
  }
  async function agregar(nuevos: { nombre: string; datos: Uint8Array; ruta?: string; clave?: string }[]) {
    if (!nuevos.length) return;
    p.alOcupado(true);
    try {
      const lista: Archivo[] = [];
      for (const n of nuevos) {
        let a = await revisar({ id: siguiente++, nombre: n.nombre, datos: n.datos, ruta: n.ruta, tamano: n.datos.byteLength, imagen: esImagen, word: esWord });
        // viene del editor con la contraseña ya escrita: no se la vuelve a pedir
        if (n.clave && (a.necesitaClave || a.seguridad?.restringido)) a = await conClave(a, n.clave);
        lista.push(a);
      }
      setArchivos((v) => (varios ? [...v, ...lista] : lista.slice(0, 1)));
      setResultado(null);
    } finally { p.alOcupado(false); }
  }
  const aBytes = (a: Abierto) => ({ nombre: a.nombre, ruta: a.ruta, datos: new Uint8Array(a.datos), clave: a.clave });

  useEffect(() => {
    if (listo.current) return;
    listo.current = true;
    if (p.inicial && !noPdf) agregar([aBytes(p.inicial)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function elegir() {
    if (esImagen) return agregar(await abrirImagenes());
    if (esWord) return agregar(await abrirWord());
    if (varios) return agregar((await abrirVarios()).map(aBytes));
    const a = await abrirConDialogo();
    if (a) agregar([aBytes(a)]);
  }
  async function soltar(e: React.DragEvent) {
    e.preventDefault(); setSoltando(false);
    if (arrastrando !== null) { setArrastrando(null); return; } // era una tarjeta de la lista, no un archivo
    const fs = [...e.dataTransfer.files].filter((f) => esImagen ? f.type.startsWith("image/") : esWord ? /\.docx?$/i.test(f.name) : (/\.pdf$/i.test(f.name) || f.type === "application/pdf"));
    if (!fs.length) return p.alAviso(T(esImagen ? "Soltá imágenes JPG o PNG." : esWord ? "Soltá documentos de Word (.docx)." : "Soltá archivos PDF."), "error");
    agregar(await Promise.all(fs.map(async (f) => ({ nombre: f.name, datos: new Uint8Array(await f.arrayBuffer()) }))));
  }
  function mover(i: number, d: number) {
    setArchivos((v) => { const n = [...v]; const j = i + d; if (j < 0 || j >= n.length) return v; [n[i], n[j]] = [n[j], n[i]]; return n; });
  }
  async function conClave(a: Archivo, clave: string): Promise<Archivo> {
    const m = motorAparte();
    await m.cerrar();
    await m.abrir(a.datos.slice().buffer);
    const r = await m.clave(clave);
    return "incorrecta" in r
      ? { ...a, error: T("Contraseña incorrecta."), tipoError: "clave" }
      : { ...a, necesitaClave: false, clave, error: undefined, tipoError: undefined, paginas: r.paginas.length, seguridad: r.seguridad };
  }
  // Los permisos del autor ("no modificar") no impiden abrir ni leer el PDF: son un pedido que cada
  // programa decide si respeta. Ozone avisa y deja seguir si la persona confirma que tiene derecho
  // (por ejemplo, unir partes de un expediente para subirlo a un trámite).
  function usarIgual(a: Archivo) {
    if (!window.confirm(T("Su autor pidió que no se modifique este PDF. Seguí solo si tenés derecho a usarlo así (por ejemplo, es tuyo o lo necesitás para un trámite). ¿Usarlo igual?"))) return;
    setAceptados((v) => new Set(v).add(a.id));
  }
  async function claveDePermisos(a: Archivo, clave: string) {
    const b = await conClave(a, clave);
    if (!b.error && b.seguridad?.restringido) { p.alAviso(T("Esa no es la contraseña de propietario."), "error"); return; }
    if (b.error) { p.alAviso(b.error, "error"); return; }
    setArchivos((v) => v.map((x) => (x.id !== a.id ? x : b)));
  }
  async function probarClave(a: Archivo, clave: string) {
    const b = await conClave(a, clave);
    setArchivos((v) => v.map((x) => (x.id !== a.id ? x : b)));
  }

  // ---------- lo que impide ejecutar ----------
  const pdfs = archivos.filter((a) => !a.imagen && !a.word);
  const faltaClave = pdfs.some((a) => a.necesitaClave);
  const conError = archivos.some((a) => a.error && !a.necesitaClave);
  const permiso = SOLO_LEER[p.id];
  const conPermisos = (a: Archivo) => !!a.seguridad?.restringido && !(permiso && a.seguridad.permisos[permiso]);
  const restringido = pdfs.find((a) => conPermisos(a) && !aceptados.has(a.id));
  const firmados = pdfs.filter((a) => a.seguridad?.firma);
  const claveOk = c1.length >= 4 && c1 === c2 && !c1.includes(",");
  const total = pdfs[0]?.paginas || 0;
  let motivo = "";
  if (!archivos.length) motivo = T(esImagen ? "Elegí o soltá las imágenes." : esWord ? "Elegí o soltá un documento de Word." : varios ? "Elegí o soltá al menos dos PDF." : "Elegí o soltá un PDF.");
  else if (p.id === "unir" && archivos.length < 2) motivo = T("Agregá al menos otro PDF para unir.");
  else if (faltaClave) motivo = T("Escribí la contraseña del PDF para seguir.");
  else if (conError) motivo = T("Sacá de la lista los archivos con error.");
  else if (restringido) motivo = T("“{n}” tiene permisos de su autor: escribí la contraseña de permisos o tocá «Usarlo igual».", { n: restringido.nombre });
  else if (p.id === "quitarclave" && !pdfs[0]?.clave && !pdfs[0]?.seguridad?.cifrado) motivo = T("Este PDF no tiene contraseña.");
  else if ((p.id === "extraer" || (p.id === "dividir" && modo === "rangos")) && !rangos.trim()) motivo = T("Escribí las páginas.");
  else if (p.id === "dividir" && modo === "tamano" && mbOpcion === "otro" && !mbValido) motivo = T("Escribí cuántos MB como máximo (por ejemplo 60).");
  else if (p.id === "clave" && !claveOk) motivo = c1 && c2 && c1 !== c2 ? T("Las contraseñas no coinciden.") : c1.includes(",") ? T("La contraseña no puede tener comas.") : T("Escribí la contraseña dos veces (al menos 4 caracteres).");

  // ---------- ejecutar ----------
  async function abrirEnMotor(a: Archivo) {
    const m = motorAparte();
    await m.cerrar();
    await m.abrir(a.datos.slice().buffer);
    if (a.clave) await m.clave(a.clave);
    return m;
  }
  async function ejecutar() {
    if (motivo || trabajando) return;
    const a = pdfs[0];
    const b = a ? base(a.nombre) : T("Imágenes");
    const junto = a?.ruta || archivos[0]?.ruta;
    p.alOcupado(true);
    setTrabajando(true);
    alAvanzar((x) => setPorcentaje(Math.round(x * 100)));
    try {
      let r: Resultado | null = null;
      const unPdf = async (datos: Uint8Array, sufijo: string, texto: string) => {
        const nombre = `${b} (${T(sufijo)}).pdf`;
        const ruta = await guardarArchivo(datos, nombre, junto);
        return ruta ? { texto, pdf: { nombre: typeof ruta === "string" && ruta.includes(".") ? ruta.split(/[\\/]/).pop()! : nombre, datos, ruta: ruta.includes("/") || ruta.includes("\\") ? ruta : undefined } } : null;
      };
      const m = motorAparte();
      if (p.id === "unir") {
        const entradas: Uint8Array[] = [];
        for (const x of archivos) {
          if (!x.clave) { entradas.push(x.datos.slice()); continue; }
          await abrirEnMotor(x);
          entradas.push((await m.guardar({ quitarClave: true })).datos); // solo en memoria, para poder unirlo
        }
        await m.cerrar();
        await m.unir(entradas);
        const { datos } = await m.guardar();
        r = await unPdf(datos, "unido", T("Listo: se unieron {n} archivos en uno.", { n: archivos.length }));
      } else if (p.id === "ocrimg") {
        const textos: string[] = [];
        for (let k = 0; k < archivos.length; k++) {
          setProgreso(archivos.length > 1 ? T("Leyendo imagen {n} de {total}…", { n: k + 1, total: archivos.length }) : T("Leyendo la imagen…"));
          const x = await leerTexto(archivos[k].datos, idiomaOcr);
          textos.push(archivos.length > 1 ? `— ${archivos[k].nombre} —\n\n${x.texto}` : x.texto);
        }
        const leido = textos.join("\n\n").trim();
        r = { texto: leido ? T("Listo: este es el texto que encontré.") : T("No encontré texto en las imágenes."), leido };
      } else if (p.id === "word2pdf") {
        const hechos: { nombre: string; datos: Uint8Array }[] = [];
        for (let k = 0; k < archivos.length; k++) {
          const x = archivos[k];
          setProgreso(archivos.length > 1 ? T("Convirtiendo {n} de {total}…", { n: k + 1, total: archivos.length }) : T("Convirtiendo…"));
          await m.cerrar();
          await m.desdeHtml(await wordAHtml(x.datos), hoja);
          const { datos } = await m.guardar();
          hechos.push({ nombre: `${base(x.nombre).replace(/\.docx?$/i, "")}.pdf`, datos });
        }
        if (hechos.length === 1) {
          const ruta = await guardarArchivo(hechos[0].datos, hechos[0].nombre, archivos[0].ruta);
          r = ruta ? { texto: T("Listo: el documento quedó en PDF."), pdf: { nombre: hechos[0].nombre, datos: hechos[0].datos, ruta: typeof ruta === "string" && /[\\/]/.test(ruta) ? ruta : undefined } } : null;
        } else if (await guardarVarios(hechos)) r = { texto: T("Listo: {n} documentos quedaron en PDF.", { n: hechos.length }) };
      } else if (p.id === "img2pdf") {
        await m.cerrar();
        const listas: Uint8Array[] = [];
        for (const x of archivos) listas.push(await prepararImagen(x.datos.slice())); // fotos derechas y formatos que el motor entiende
        await m.desdeImagenes(listas, false);
        const { datos } = await m.guardar();
        const hoy = new Date().toISOString().slice(0, 10);
        const nombre = `${T("Imágenes")} ${hoy}.pdf`;
        const ruta = await guardarArchivo(datos, nombre, junto);
        r = ruta ? { texto: archivos.length === 1 ? T("Listo: la imagen quedó en un PDF.") : T("Listo: {n} imágenes en un PDF.", { n: archivos.length }), pdf: { nombre, datos, ruta: typeof ruta === "string" && /[\\/]/.test(ruta) ? ruta : undefined } } : null;
      } else {
        await abrirEnMotor(a);
        if (p.id === "comprimir") {
          await m.comprimir(nivel);
          const { datos } = await m.guardar(a.clave ? { clave: a.clave } : {});
          const ahorro = Math.max(0, Math.round((1 - datos.byteLength / a.tamano) * 100));
          // si no se achicó (o hasta creció), no se guarda una copia que pesa igual o más
          if (datos.byteLength >= a.tamano * 0.98) r = { texto: T("Este PDF ya estaba bien comprimido: no se pudo achicar más.") };
          else r = await unPdf(datos, "comprimido", T("Listo: de {a} a {b} (−{p}%).", { a: tam(a.tamano), b: tam(datos.byteLength), p: ahorro }));
        } else if (p.id === "extraer") {
          const x = await m.extraer(rangos, a.clave);
          r = await unPdf(x.datos, `p${rangos.replace(/\s+/g, "").replace(/[^\d,;-]/g, "")}`,
            (x.paginas === 1 ? T("Listo: se guardó 1 página en un archivo nuevo.") : T("Listo: se guardaron {n} páginas en un archivo nuevo.", { n: x.paginas })) + avisoClave(a));
        } else if (p.id === "clave") {
          const { datos } = await m.guardar({ clave: c1 });
          r = await unPdf(datos, "con contraseña", T("Listo: se guardó una copia con contraseña."));
        } else if (p.id === "quitarclave") {
          const { datos } = await m.guardar({ quitarClave: true });
          r = await unPdf(datos, "sin contraseña", T("Listo: se guardó una copia sin contraseña."));
        } else if (p.id === "limpiar") {
          await m.limpiarDatos();
          const { datos } = await m.guardar(a.clave ? { clave: a.clave } : {});
          r = await unPdf(datos, "limpio", T("Listo: se guardó una copia sin datos ocultos."));
        } else if (p.id === "dividir") {
          const valor = modo === "rangos" ? rangos : modo === "tamano" ? mb * 1024 * 1024 : null;
          const x = await m.dividir(modo, valor, a.clave);
          const lista = x.partes.map((y, i) => ({ nombre: `${b} - ${T("parte")} ${i + 1}${y.desde === y.hasta ? ` (p${y.desde})` : ` (p${y.desde}-${y.hasta})`}.pdf`, datos: y.datos }));
          if (await guardarVarios(lista)) r = { texto: creados(lista.length) + avisoClave(a) };
        } else if (p.id === "imagenes") {
          const x = await m.aImagenes(dpi, formato);
          const lista = x.lista.map((y) => ({ nombre: `${b} - ${String(y.pagina).padStart(3, "0")}.${formato}`, datos: y.datos }));
          if (await guardarVarios(lista)) r = { texto: creados(lista.length) };
        } else if (p.id === "buscable") {
          const n = a.paginas || 0;
          let hechas = 0, yaTenian = 0;
          for (let i = 0; i < n; i++) {
            setProgreso(T("Leyendo página {n} de {total}…", { n: i + 1, total: n })); setPorcentaje(0);
            const pg = await m.paginaParaOcr(i, 300);
            if (pg.conTexto) { yaTenian++; continue; }
            const capa = await capaDeTexto(pg.png, pg.dpi, idiomaOcr);
            if (!capa.palabras) continue;
            await m.agregarCapaTexto(i, capa.pdf);
            hechas++;
          }
          if (!hechas) r = { texto: yaTenian === n ? T("Este PDF ya tiene texto: se puede buscar y copiar sin hacer nada.") : T("No encontré texto para reconocer en este PDF.") };
          else {
            const { datos } = await m.guardar(a.clave ? { clave: a.clave } : {});
            r = await unPdf(datos, "buscable", hechas === 1 ? T("Listo: ahora se puede buscar y copiar el texto.") : T("Listo: ahora se puede buscar y copiar el texto de {n} páginas.", { n: hechas }));
          }
        } else if (p.id === "pdf2word") {
          setProgreso(T("Convirtiendo…"));
          const paginas = await m.aWord();
          const hayTexto = paginas.some((x) => x.bloques.some((y) => y.tipo === "t"));
          if (!hayTexto) r = { texto: T("Este PDF no tiene texto (parece escaneado). Primero usá «Hacer buscable un PDF» y después convertilo a Word.") };
          else if (await guardarArchivo(armarDocx(paginas), `${b}.docx`, junto)) r = { texto: T("Listo: se guardó el documento de Word.") };
        } else if (p.id === "texto") {
          const partes = await m.aTexto();
          const texto = partes.map((t, i) => `— ${T("Página {n} de {total}", { n: i + 1, total: partes.length })} —\n\n${t}`).join("\n\n");
          if (await guardarArchivo(new TextEncoder().encode(texto), `${b}.txt`, junto)) r = { texto: T("Listo: texto guardado.") };
        }
      }
      await m.cerrar();
      if (!r) return;
      setResultado(r);
      p.alTerminado(r.texto);
      if (abrirAlTerminar && r.pdf) p.alAbrirResultado({ nombre: r.pdf.nombre, datos: r.pdf.datos.slice().buffer, ruta: r.pdf.ruta });
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || "");
      p.alAviso(msg.includes("RANGO") ? T("Revisá las páginas: por ejemplo 1-3, 5 (y que existan en el PDF)")
        : msg.includes("CLAVE_COMA") ? T("La contraseña no puede tener comas.")
        : msg.includes("CON_CLAVE") ? T("Uno de los PDF tiene contraseña. Abrilo primero y guardalo sin contraseña.")
        : T("Algo salió mal. Probá de nuevo."), "error");
    } finally {
      p.alOcupado(false);
      setTrabajando(false); setProgreso(""); setPorcentaje(0);
      alAvanzar(null);
    }
  }
  const creados = (n: number) => (n === 1 ? T("Listo: se creó 1 archivo.") : T("Listo: se crearon {n} archivos.", { n }));
  // las copias de un PDF con contraseña salen con la misma contraseña (salvo que tenga comas)
  const avisoClave = (a: Archivo) => (!a.clave ? "" : a.clave.includes(",") ? " " + T("Ojo: las copias quedaron sin contraseña.") : " " + T("Con la misma contraseña que el original."));
  async function guardarLeido(texto: string) {
    const nombre = `${archivos.length === 1 ? base(archivos[0].nombre) : T("Texto")}.txt`;
    if (await guardarArchivo(new TextEncoder().encode(texto), nombre, archivos[0]?.ruta)) p.alAviso(T("Listo: texto guardado."), "ok");
  }

  const I = h.icono;
  return (
    <section className={"rapida" + (soltando ? " rapida--soltando" : "")} aria-labelledby="titulo-rapida"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.types.includes("Files")) setSoltando(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setSoltando(false); }}
      onDrop={soltar}>
      <div className="rapida__cabeza">
        <img className="rapida__labcin" src="/img/intro-avatar-solo.png" alt="" width={52} height={52} />
        <button className="icono" onClick={p.alVolver} disabled={trabajando} aria-label={T("Volver")} title={T("Volver")}><ArrowLeft size={20} /></button>
        <span className="tarjeta__icono"><I size={22} aria-hidden /></span>
        <div>
          <h1 id="titulo-rapida">{T(h.nombre)}</h1>
          <p>{T(h.desc)} {T("Tu archivo original no se toca.")}</p>
        </div>
      </div>

      {resultado ? (
        <div className="rapida__listo">
          <CheckCircle2 size={46} aria-hidden />
          <h2>{resultado.texto}</h2>
          {resultado.leido && <textarea className="campo rapida__leido" defaultValue={resultado.leido} aria-label={T("Texto encontrado")} spellCheck={false} />}
          <div className="rapida__botones">
            {resultado.leido && <>
              <button className="boton boton--primario boton--grande" onClick={async (e) => {
                const area = (e.currentTarget.closest(".rapida__listo")?.querySelector("textarea") as HTMLTextAreaElement | null);
                try { await navigator.clipboard.writeText(area?.value ?? resultado.leido!); p.alAviso(T("Texto copiado."), "ok"); }
                catch { area?.select(); document.execCommand("copy"); p.alAviso(T("Texto copiado."), "ok"); }
              }}><Copy size={18} aria-hidden /> {T("Copiar texto")}</button>
              <button className="boton boton--suave boton--grande" onClick={(e) => {
                const area = (e.currentTarget.closest(".rapida__listo")?.querySelector("textarea") as HTMLTextAreaElement | null);
                guardarLeido(area?.value ?? resultado.leido!);
              }}><Download size={18} aria-hidden /> {T("Guardar como .txt")}</button>
            </>}
            {resultado.pdf && <button className="boton boton--primario boton--grande" onClick={() => p.alAbrirResultado({ nombre: resultado.pdf!.nombre, datos: resultado.pdf!.datos.slice().buffer, ruta: resultado.pdf!.ruta })}>{T("Abrir el resultado")}</button>}
            <button className="boton boton--suave boton--grande" onClick={() => { setResultado(null); setArchivos([]); }}>{T("Hacer otro")}</button>
            <button className="boton boton--suave boton--grande" onClick={p.alVolver}>{T("Volver")}</button>
          </div>
          <p className="rapida__cafecito">{T("¿Te sirvió? Ozone PDF es gratis y lo hago en mis ratos libres.")}{" "}
            <a href="https://cafecito.app/pachelabs" onClick={(e) => { e.preventDefault(); abrirEnlace("https://cafecito.app/pachelabs"); }}>☕ {T("Invitame un cafecito")}</a>
          </p>
        </div>
      ) : (
        <div className="rapida__cuerpo">
          <div className="rapida__archivos">
            <button className="rapida__zona" onClick={elegir}>
              <FilePlus2 size={26} aria-hidden />
              <strong>{T(esImagen ? "Elegí o soltá imágenes acá" : esWord ? "Elegí o soltá documentos de Word acá" : varios ? "Elegí o soltá los PDF acá" : archivos.length ? "Cambiar el PDF" : "Elegí o soltá un PDF acá")}</strong>
              <small>{T(esWord ? "Podés agregar varios: cada uno queda en su propio PDF." : varios ? "Podés agregar varios y ordenarlos arrastrando." : "El original no se modifica.")}</small>
            </button>
            {archivos.length > 0 && (
              <ol className="rapida__lista">
                {archivos.map((a, i) => (
                  <li key={a.id}
                    className={(a.error && !a.necesitaClave ? "con-error" : "") + (varios ? " arrastrable" : "") + (arrastrando === a.id ? " arrastrando" : "")}
                    draggable={varios}
                    onDragStart={(e) => { setArrastrando(a.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(a.id)); }}
                    onDragEnd={() => setArrastrando(null)}
                    onDragOver={(e) => {
                      if (arrastrando === null || arrastrando === a.id) return;
                      e.preventDefault();
                      setArchivos((v) => {
                        const de = v.findIndex((x) => x.id === arrastrando), a2 = v.findIndex((x) => x.id === a.id);
                        if (de < 0 || a2 < 0) return v;
                        const n = [...v]; n.splice(a2, 0, n.splice(de, 1)[0]); return n;
                      });
                    }}>
                    <span className="rapida__num">{i + 1}</span>
                    <span className="rapida__nombre">
                      <strong title={a.nombre}>{a.imagen || a.word ? null : <FileText size={14} aria-hidden />} {a.nombre}</strong>
                      <small>
                        {tam(a.tamano)}{a.paginas ? ` · ${a.paginas === 1 ? T("1 página") : T("{n} páginas", { n: a.paginas })}` : ""}
                      </small>
                    </span>
                    {varios && !esWord && <>
                      <button className="icono" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={T("Subir")} title={T("Subir")}><ArrowUp size={16} /></button>
                      <button className="icono" onClick={() => mover(i, 1)} disabled={i === archivos.length - 1} aria-label={T("Bajar")} title={T("Bajar")}><ArrowDown size={16} /></button>
                    </>}
                    <button className="icono" onClick={() => setArchivos((v) => v.filter((x) => x.id !== a.id))} aria-label={T("Sacar de la lista")} title={T("Sacar de la lista")}><X size={16} /></button>
                    {/* debajo, a lo ancho de la tarjeta: avisos, contraseñas y "Usarlo igual" (en el celular no entran al lado del nombre) */}
                    {(a.seguridad?.firma || conPermisos(a) || a.error || a.necesitaClave) && (
                      <div className="rapida__extra">
                        <div className="rapida__etiquetas">
                          {a.seguridad?.firma === "valida" && <Etiqueta alTocar={() => setExplicando({ tema: "firma", archivo: a })}><BadgeCheck size={13} aria-hidden /> {T("Con firma digital: la copia no va a tener una firma válida")}</Etiqueta>}
                          {a.seguridad?.firma === "alterada" && <Etiqueta alTocar={() => setExplicando({ tema: "firmaAlterada", archivo: a })}><ShieldAlert size={13} aria-hidden /> {T("Su firma digital ya no es válida")}</Etiqueta>}
                          {conPermisos(a) && (aceptados.has(a.id)
                            ? <Etiqueta alTocar={() => setExplicando({ tema: "permisos", archivo: a })}><ShieldAlert size={13} aria-hidden /> {T("Con permisos del autor: se usa igual")}</Etiqueta>
                            : <Etiqueta mal alTocar={() => setExplicando({ tema: "permisos", archivo: a })}><ShieldAlert size={13} aria-hidden /> {T("Su autor pidió que no se modifique")}</Etiqueta>)}
                          {a.error && (a.tipoError
                            ? <Etiqueta mal alTocar={() => setExplicando({ tema: a.tipoError!, archivo: a })}>{a.error}</Etiqueta>
                            : <span className="rapida__marca rapida__marca--mal">{a.error}</span>)}
                        </div>
                      {conPermisos(a) && !aceptados.has(a.id) && (
                        <div className="rapida__permisos">
                          <form className="rapida__clave" onSubmit={(e) => { e.preventDefault(); claveDePermisos(a, String(new FormData(e.currentTarget).get("c") || "")); }}>
                            <Lock size={14} aria-hidden />
                            <input name="c" type="password" className="campo campo--chico" placeholder={T("Contraseña")} aria-label={T("Contraseña de permisos de {n}", { n: a.nombre })} />
                            <button className="boton boton--suave boton--chico">{T("Aceptar")}</button>
                          </form>
                          <button type="button" className="boton boton--suave boton--chico" onClick={() => usarIgual(a)}>{T("Usarlo igual")}</button>
                        </div>
                      )}
                      {a.necesitaClave && (
                        <form className="rapida__clave" onSubmit={(e) => { e.preventDefault(); probarClave(a, String(new FormData(e.currentTarget).get("c") || "")); }}>
                          <Lock size={14} aria-hidden />
                          <input name="c" type="password" className="campo campo--chico" placeholder={T("Contraseña")} aria-label={T("Contraseña de {n}", { n: a.nombre })} autoFocus />
                          <button className="boton boton--suave boton--chico">{T("Aceptar")}</button>
                        </form>
                      )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {firmados.length > 0 && <p className="modal__ayuda">{T("El original sigue firmado: para trámites usá siempre el original.")}</p>}
          </div>

          <div className="rapida__opciones opciones">
            {p.id === "dividir" && <>
              <Opciones nombre="modo" titulo="Cómo dividir" valor={modo} alCambiar={setModo}
                opciones={[{ v: "cada", t: "Cada página por separado" }, { v: "rangos", t: "Por rangos" }, { v: "tamano", t: "Por tamaño" }]} />
              {modo === "cada" && total > 0 && <p className="modal__ayuda">{T("Se crean {n} archivos, uno por página.", { n: total })}</p>}
              {modo === "rangos" && <label className="campo-etiqueta">{T("Un archivo por rango, separados por punto y coma")}
                <input className="campo" value={rangos} onChange={(e) => setRangos(e.target.value)} placeholder={`1-3; 4-${Math.max(4, total)}`} /></label>}
              {modo === "tamano" && <Opciones<number | "otro"> nombre="mb" titulo="Máximo por archivo" valor={mbOpcion} alCambiar={setMbOpcion}
                opciones={[...[1, 2, 5, 10, 20].map((v) => ({ v, t: `${v} MB` })), { v: "otro" as const, t: "Otro" }]} />}
              {modo === "tamano" && mbOpcion === "otro" && (
                <label className="campo-etiqueta">{T("Máximo en MB")}
                  <input className="campo campo--chico" inputMode="decimal" placeholder="60" value={mbTexto} autoFocus
                    onChange={(e) => setMbTexto(e.target.value.replace(/[^\d.,]/g, ""))} aria-invalid={!!mbTexto && !mbValido} />
                  {!!mbTexto && !mbValido && <small className="error">{T("Poné un número entre 0,1 y 2000.")}</small>}
                </label>
              )}
            </>}
            {p.id === "extraer" && <label className="campo-etiqueta">{T("Páginas a extraer")}
              <input className="campo" value={rangos} onChange={(e) => setRangos(e.target.value)} placeholder="1-3, 5" /></label>}
            {p.id === "comprimir" && <>
              <Opciones nombre="nivel" titulo="Nivel" valor={nivel} alCambiar={setNivel}
                opciones={[{ v: "liviana", t: "Liviana" }, { v: "equilibrada", t: "Equilibrada" }, { v: "maxima", t: "Máxima" }]} />
              <p className="modal__ayuda">{T(nivel === "liviana" ? "Casi sin diferencia visible." : nivel === "equilibrada" ? "Ideal para mandar por mail o WhatsApp." : "Lo más chico posible; las fotos pierden algo de detalle.")}</p>
            </>}
            {p.id === "clave" && <>
              <label className="campo-etiqueta">{T("Contraseña nueva")}<input className="campo" type="password" value={c1} onChange={(e) => setC1(e.target.value)} autoComplete="new-password" /></label>
              <label className="campo-etiqueta">{T("Repetila")}<input className="campo" type="password" value={c2} onChange={(e) => setC2(e.target.value)} autoComplete="new-password" /></label>
            </>}
            {p.id === "imagenes" && <>
              <Opciones nombre="fmt" titulo="Formato" valor={formato} alCambiar={setFormato} opciones={[{ v: "jpg", t: "JPG" }, { v: "png", t: "PNG" }]} />
              <Opciones nombre="dpi" titulo="Calidad" valor={dpi} alCambiar={setDpi} opciones={[{ v: 96, t: "Pantalla" }, { v: 150, t: "Normal" }, { v: 300, t: "Impresión" }]} />
            </>}
            {p.id === "texto" && <p className="modal__ayuda">{T("Se guarda un archivo .txt con el texto de todas las páginas. Si el PDF es escaneado, primero usá «Hacer buscable un PDF».")}</p>}
            {(p.id === "buscable" || p.id === "ocrimg") && <>
              <label className="campo-etiqueta">{T("Idioma del texto")}
                <select className="campo" value={idiomaOcr} onChange={(e) => setIdiomaOcr(e.target.value as IdiomaOcr)}>
                  {IDIOMAS_OCR.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </select>
              </label>
              <p className="modal__ayuda">{T(p.id === "buscable"
                ? "Lee cada página escaneada y le agrega el texto por debajo: se ve igual, pero vas a poder buscar (Ctrl+F), seleccionar y copiar. Todo pasa en tu computadora."
                : "Lee el texto de fotos o escaneos para que lo copies o lo guardes. Funciona mejor con fotos derechas y bien iluminadas. Todo pasa en tu computadora.")}</p>
            </>}
            {p.id === "limpiar" && <p className="modal__ayuda">{T("Se borra lo que el PDF guarda sin que se vea: autor, programa, fechas, adjuntos y nombres en las notas.")}</p>}
            {p.id === "unir" && <p className="modal__ayuda">{T("Se unen en el orden de la lista. Arrastrá las tarjetas o usá las flechas para cambiarlo.")}</p>}
            {p.id === "word2pdf" && <>
              <Opciones nombre="hoja" titulo="Tamaño de hoja" valor={hoja} alCambiar={setHoja} opciones={[{ v: "a4", t: "A4" }, { v: "carta", t: "Carta" }]} />
              <p className="modal__ayuda">{T("Se mantienen los títulos, negritas, listas, tablas e imágenes. Los diseños muy armados (columnas, cuadros de texto, encabezados) pueden quedar más simples.")}</p>
            </>}
            {p.id === "pdf2word" && <p className="modal__ayuda">{T("Se pasa el texto con sus tamaños, negritas, cursivas e imágenes, listo para editar en Word. Los diseños muy armados (columnas o tablas) pueden quedar más simples. Si el PDF es escaneado, primero usá «Hacer buscable un PDF».")}</p>}
            {p.id === "img2pdf" && <p className="modal__ayuda">{T("Cada imagen queda en una página A4, centrada, en el orden de la lista.")}</p>}

            {p.id !== "ocrimg" && p.id !== "pdf2word" && <label className="rapida__abrir">
              <input type="checkbox" checked={abrirAlTerminar} onChange={(e) => { setAbrirAlTerminar(e.target.checked); try { localStorage.setItem(CLAVE_ABRIR, e.target.checked ? "1" : "0"); } catch { /* nada */ } }} />
              {T("Abrir el resultado al terminar")}
            </label>}
            {motivo && <p className="rapida__motivo">{motivo}</p>}
            <button className="boton boton--primario boton--grande rapida__hacer" disabled={!!motivo || trabajando} onClick={ejecutar}>
              <I size={20} aria-hidden /> {T(h.nombre)}
            </button>
            {trabajando && progreso && (
              <div className="rapida__progreso" role="status" aria-live="polite">
                <span>{progreso}</span>
                <span className="rapida__barra"><span style={{ width: `${porcentaje}%` }} /></span>
              </div>
            )}
          </div>
        </div>
      )}
      {explicando && (() => {
        const e = EXPLICACION[explicando.tema];
        const a = explicando.archivo;
        const pendiente = explicando.tema === "permisos" && !aceptados.has(a.id) && archivos.some((x) => x.id === a.id);
        return (
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="titulo-explica" onPointerDown={(ev) => ev.target === ev.currentTarget && setExplicando(null)}>
            <div className="modal__caja modal__caja--seguridad">
              <h2 id="titulo-explica"><ShieldAlert size={22} aria-hidden /> {T(e.titulo)}</h2>
              <p className="modal__ayuda explica__archivo">{a.nombre}</p>
              {e.texto.map((t) => <p key={t}>{T(t)}</p>)}
              <div className="modal__botones">
                {pendiente && <button className="boton boton--suave" onClick={() => { setExplicando(null); usarIgual(a); }}>{T("Usarlo igual")}</button>}
                {a.error && <button className="boton boton--suave" onClick={() => { setExplicando(null); setArchivos((v) => v.filter((x) => x.id !== a.id)); }}>{T("Sacar de la lista")}</button>}
                <span className="espacio" />
                <button className="boton boton--primario" autoFocus onClick={() => setExplicando(null)}>{T("Entendido")}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}

// Etiqueta de un archivo que se puede tocar para ver qué significa.
function Etiqueta(p: { mal?: boolean; alTocar: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={"rapida__marca rapida__marca--tocable" + (p.mal ? " rapida__marca--mal" : "")} onClick={p.alTocar}
      title={T("Tocá para ver qué significa")}>
      {p.children} <Info size={13} aria-hidden className="rapida__info" />
    </button>
  );
}
