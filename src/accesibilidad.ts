// Opciones de accesibilidad de Ozone PDF. Se guardan solo en este equipo.
export type A11y = {
  tamano: "normal" | "grande" | "muygrande";
  contraste: boolean;
  movimiento: boolean; // true = menos movimiento
  espaciado: boolean;
  voz: boolean;        // Labcin lee sus tips en voz alta
};

const CLAVE = "ozone.accesibilidad";
export const A11Y_INICIAL: A11y = { tamano: "normal", contraste: false, movimiento: false, espaciado: false, voz: false };

export function leerA11y(): A11y {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || "null");
    if (g) return { ...A11Y_INICIAL, ...g };
  } catch { /* nada */ }
  return {
    ...A11Y_INICIAL,
    // en el celular la letra arranca un poco más grande (se lee mejor en pantalla chica); se puede cambiar
    tamano: window.matchMedia("(max-width: 760px)").matches ? "grande" : "normal",
    contraste: window.matchMedia("(prefers-contrast: more)").matches,
    movimiento: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

export function aplicarA11y(a: A11y, guardar = true) {
  const c = document.documentElement.classList;
  c.toggle("a11y-grande", a.tamano === "grande");
  c.toggle("a11y-muygrande", a.tamano === "muygrande");
  c.toggle("a11y-contraste", a.contraste);
  c.toggle("a11y-sin-movimiento", a.movimiento);
  c.toggle("a11y-espaciado", a.espaciado);
  if (guardar) try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch { /* nada */ }
}

// Lee un texto en voz alta con las voces instaladas en el equipo.
// Solo usa voces locales: las voces "en línea" mandan el texto a un servidor, y eso no va con Ozone PDF.
const REGION: Record<string, string[]> = {
  es: ["es-ar", "es-419", "es-mx", "es-us", "es-cl", "es-co", "es-uy", "es-es"],
  en: ["en-us", "en-gb", "en-au", "en-ca"], de: ["de-de", "de-at", "de-ch"],
  zh: ["zh-cn", "zh-tw", "zh-hk"], ja: ["ja-jp"], ru: ["ru-ru"],
};
function puntaje(v: SpeechSynthesisVoice, idioma: string) {
  const n = v.name.toLowerCase(), l = v.lang.toLowerCase().replace("_", "-");
  let p = 0;
  if (/natural|neural|premium|enhanced|mejorada/.test(n)) p += 100;   // voces nuevas, mucho más fluidas
  if (/desktop|espeak|robot/.test(n)) p -= 30;                         // las más viejas y robóticas
  const r = REGION[idioma]?.indexOf(l) ?? -1;
  if (r >= 0) p += 20 - r * 2;
  if (v.default) p += 1;
  return p;
}
let voces: SpeechSynthesisVoice[] = [];
function cargarVoces() { try { voces = window.speechSynthesis?.getVoices() || []; } catch { voces = []; } }
try { cargarVoces(); window.speechSynthesis?.addEventListener?.("voiceschanged", cargarVoces); } catch { /* nada */ }

export function mejorVoz(idioma: string) {
  if (!voces.length) cargarVoces();
  return voces
    .filter((v) => v.localService && v.lang.toLowerCase().startsWith(idioma))
    .sort((a, b) => puntaje(b, idioma) - puntaje(a, idioma))[0] || null;
}

export function hablar(texto: string, idioma: string) {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const voz = mejorVoz(idioma);
    if (!voz) return; // sin voz instalada en el equipo, mejor no hablar que mandar el texto afuera
    const limpio = texto.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim();
    // frases cortas suenan más naturales que un párrafo de corrido
    const frases = limpio.match(/[^.!?¡¿…]+[.!?…]*/g) || [limpio];
    const natural = /natural|neural|premium|enhanced/i.test(voz.name);
    for (const f of frases) {
      if (!f.trim()) continue;
      const u = new SpeechSynthesisUtterance(f.trim());
      u.voice = voz; u.lang = voz.lang;
      u.rate = natural ? 1 : 0.94;   // las voces viejas suenan mejor un poquito más lentas
      u.pitch = natural ? 1 : 1.08;  // y un toque más agudas, más simpáticas
      s.speak(u);
    }
  } catch { /* sin voz disponible */ }
}

export function hayVoz() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Tema claro u oscuro: "auto" sigue al sistema. Se guarda solo en este equipo.
export type Tema = "auto" | "claro" | "oscuro";
const CLAVE_TEMA = "ozone.tema";
const sistemaOscuro = window.matchMedia("(prefers-color-scheme: dark)");
let temaActual: Tema = "auto";
export function leerTema(): Tema {
  // de entrada es claro; si la persona elige otro, se recuerda
  try { const t = localStorage.getItem(CLAVE_TEMA); if (t === "claro" || t === "oscuro" || t === "auto") return t; } catch { /* nada */ }
  return "claro";
}
function pintarTema() {
  const oscuro = temaActual === "oscuro" || (temaActual === "auto" && sistemaOscuro.matches);
  document.documentElement.classList.toggle("tema-oscuro", oscuro);
  document.documentElement.style.colorScheme = oscuro ? "dark" : "light";
}
export function aplicarTema(t: Tema, guardar = true) {
  temaActual = t;
  pintarTema();
  if (guardar) try { localStorage.setItem(CLAVE_TEMA, t); } catch { /* nada */ }
}
sistemaOscuro.addEventListener?.("change", pintarTema);
aplicarTema(leerTema(), false);
