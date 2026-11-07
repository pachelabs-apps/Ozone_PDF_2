import { useEffect, useRef, useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { montarLabcin, type LabcinApi } from "./labcin.js";
import { T } from "../i18n";

export type EventoLabcin = { texto: string; tipo?: "saludo" | "festejo" | "tip"; n: number };

const CLAVE = "ozone.labcin";
const TIPS_GENERALES = [
  "Ozone PDF funciona sin internet: tus archivos nunca salen de tu equipo.",
  "Podés arrastrar un PDF directo a la ventana para abrirlo.",
  "Con Ctrl + y Ctrl − hacés zoom.",
  "Elegí una herramienta de arriba. Si te equivocás, Ctrl+Z deshace.",
  "Si te sirvió Ozone PDF, podés invitarme un cafecito en pachelabs.net ☕",
];

function leer() {
  try { return localStorage.getItem(CLAVE); } catch { return null; }
}
function escribir(v: string | null) {
  try { v ? localStorage.setItem(CLAVE, v) : localStorage.removeItem(CLAVE); } catch { /* nada */ }
}

// Labcin, el asistente: se queda en una esquina y da tips según lo que estés haciendo.
export default function Labcin({ evento }: { evento: EventoLabcin | null }) {
  const caja = useRef<HTMLDivElement>(null);
  const api = useRef<LabcinApi | null>(null);
  const [oculto, setOculto] = useState(() => leer() === "oculto");
  const [globo, setGlobo] = useState<string | null>(null);
  const toques = useRef(0);
  const indice = useRef(0);
  const reloj = useRef<number | undefined>(undefined);
  const encima = useRef(false);
  const tocarRef = useRef<() => void>(() => {});

  function programarCierre(ms: number) {
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => { if (!encima.current) setGlobo(null); }, ms);
  }

  function decir(texto: string, ms = 9000) {
    setGlobo(texto);
    programarCierre(ms);
  }

  function otroTip() {
    const lista = TIPS_GENERALES.filter((t) => T(t) !== globo);
    const t = lista[indice.current++ % lista.length];
    api.current?.hablar();
    decir(T(t));
  }

  tocarRef.current = () => {
    const a = api.current;
    if (!a || a.ocupado()) return;
    toques.current += 1;
    if (toques.current % 5 === 0) {
      a.romper();
      decir(T("No me toques tanto que me rompo… 🧪"), 6000);
    } else {
      a.reir();
      otroTip();
    }
  };

  // montar el personaje
  useEffect(() => {
    if (oculto || !caja.current) return;
    const el = caja.current;
    el.innerHTML = "";
    api.current = montarLabcin(el, { alTocar: () => tocarRef.current() });
    return () => { api.current = null; el.innerHTML = ""; };
  }, [oculto]);

  // reaccionar a lo que pasa en la app
  useEffect(() => {
    if (!evento || oculto) return;
    decir(evento.texto, evento.tipo === "saludo" ? 10000 : 9000);
    const a = api.current;
    if (!a) return;
    if (evento.tipo === "saludo") a.saludar();
    else if (evento.tipo === "festejo") a.festejar();
    else a.hablar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento?.n]);

  useEffect(() => () => window.clearTimeout(reloj.current), []);

  if (oculto) {
    return (
      <button
        className="labcin-volver"
        title={T("Mostrar a Labcin")}
        aria-label={T("Mostrar a Labcin")}
        onClick={() => { escribir(null); setOculto(false); setTimeout(() => decir(T("¡Hola, soy Labcin! Abrí un PDF y te voy dando tips.")), 300); }}
      >
        <FlaskConical size={20} aria-hidden />
      </button>
    );
  }

  return (
    <aside className="labcin-app" aria-live="polite">
      {globo && (
        <div
          className="labcin-app__globo"
          onMouseEnter={() => { encima.current = true; window.clearTimeout(reloj.current); }}
          onMouseLeave={() => { encima.current = false; programarCierre(3500); }}
        >
          <button className="labcin-app__cerrar" onClick={() => setGlobo(null)} aria-label={T("Cerrar")} title={T("Cerrar")}>
            <X size={15} />
          </button>
          <p>{globo}</p>
          <div className="labcin-app__acciones">
            <button onClick={otroTip}>{T("Otro tip")}</button>
            <button className="labcin-app__ocultar" onClick={() => { escribir("oculto"); setGlobo(null); setOculto(true); }}>
              {T("Ocultar a Labcin")}
            </button>
          </div>
        </div>
      )}
      <div ref={caja} className="labsin labcin-app__personaje" aria-label="Labcin" />
    </aside>
  );
}
