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

// Lee un texto en voz alta con las voces del sistema (sin internet).
export function hablar(texto: string, idioma: string) {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(texto.replace(/[\u{1F300}-\u{1FAFF}☕🧪]/gu, ""));
    const mapa: Record<string, string> = { es: "es-AR", en: "en-US", de: "de-DE", zh: "zh-CN", ja: "ja-JP", ru: "ru-RU" };
    u.lang = mapa[idioma] || idioma;
    const voz = s.getVoices().find((v) => v.lang.toLowerCase().startsWith(idioma));
    if (voz) u.voice = voz;
    u.rate = 1;
    s.speak(u);
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
  try { const t = localStorage.getItem(CLAVE_TEMA); if (t === "claro" || t === "oscuro") return t; } catch { /* nada */ }
  return "auto";
}
function pintarTema() {
  const oscuro = temaActual === "oscuro" || (temaActual === "auto" && sistemaOscuro.matches);
  document.documentElement.classList.toggle("tema-oscuro", oscuro);
  document.documentElement.style.colorScheme = oscuro ? "dark" : "light";
}
export function aplicarTema(t: Tema, guardar = true) {
  temaActual = t;
  pintarTema();
  if (guardar) try { t === "auto" ? localStorage.removeItem(CLAVE_TEMA) : localStorage.setItem(CLAVE_TEMA, t); } catch { /* nada */ }
}
sistemaOscuro.addEventListener?.("change", pintarTema);
aplicarTema(leerTema(), false);
