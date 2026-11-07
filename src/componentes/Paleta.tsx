import { useMemo, useRef, useState, type ComponentType } from "react";
import { Search } from "lucide-react";
import { T } from "../i18n";

export type Comando = {
  id: string;
  titulo: string;
  desc?: string;
  icono: ComponentType<{ size?: number }>;
  palabras?: string;   // sinónimos para encontrarlo
  deshabilitado?: boolean;
  accion: () => void;
};

function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Buscador de todo lo que hace la app (Ctrl+K).
export default function Paleta(p: { comandos: Comando[]; alCerrar: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const filtrados = useMemo(() => {
    const t = normalizar(q.trim());
    const disponibles = p.comandos.filter((c) => !c.deshabilitado);
    if (!t) return disponibles;
    return disponibles
      .map((c) => {
        const titulo = normalizar(c.titulo), extra = normalizar(`${c.desc || ""} ${c.palabras || ""}`);
        const puntos = titulo.startsWith(t) ? 3 : titulo.includes(t) ? 2 : t.split(/\s+/).every((w) => (titulo + " " + extra).includes(w)) ? 1 : 0;
        return { c, puntos };
      })
      .filter((x) => x.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos)
      .map((x) => x.c);
  }, [q, p.comandos]);

  function ejecutar(c?: Comando) {
    if (!c) return;
    p.alCerrar();
    setTimeout(c.accion, 0);
  }

  return (
    <div className="modal modal--arriba" role="dialog" aria-modal="true" aria-label={T("Buscar herramienta")} onPointerDown={(e) => e.target === e.currentTarget && p.alCerrar()}>
      <div className="paleta">
        <label className="paleta__buscar">
          <Search size={20} aria-hidden />
          <input
            autoFocus
            value={q}
            placeholder={T("¿Qué querés hacer? Por ejemplo: firmar, achicar, unir…")}
            aria-label={T("Buscar herramienta")}
            aria-controls="paleta-lista"
            aria-activedescendant={filtrados[sel] ? `cmd-${filtrados[sel].id}` : undefined}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(filtrados.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); ejecutar(filtrados[sel]); }
              else if (e.key === "Escape") { e.preventDefault(); p.alCerrar(); }
              requestAnimationFrame(() => lista.current?.querySelector(".paleta__item--sel")?.scrollIntoView({ block: "nearest" }));
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <ul className="paleta__lista" id="paleta-lista" role="listbox" ref={lista}>
          {filtrados.map((c, i) => {
            const I = c.icono;
            return (
              <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === sel}
                className={"paleta__item" + (i === sel ? " paleta__item--sel" : "")}
                onPointerMove={() => setSel(i)} onClick={() => ejecutar(c)}>
                <span className="paleta__icono"><I size={18} /></span>
                <span className="paleta__texto"><strong>{c.titulo}</strong>{c.desc && <small>{c.desc}</small>}</span>
              </li>
            );
          })}
          {!filtrados.length && <li className="paleta__vacio">{T("No encontré nada con eso. Probá con otra palabra.")}</li>}
        </ul>
      </div>
    </div>
  );
}
