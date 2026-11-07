import { Accessibility, X } from "lucide-react";
import { T, idioma } from "../i18n";
import { hablar, hayVoz, mejorVoz, type A11y } from "../accesibilidad";

export default function Accesibilidad(p: { valor: A11y; alCambiar: (a: A11y) => void; alCerrar: () => void }) {
  const a = p.valor;
  const cambiar = (c: Partial<A11y>) => p.alCambiar({ ...a, ...c });
  const interruptor = (clave: "contraste" | "movimiento" | "espaciado" | "voz", titulo: string, desc: string) => (
    <label className="interruptor">
      <span className="interruptor__texto"><strong>{T(titulo)}</strong><small>{T(desc)}</small></span>
      <input type="checkbox" role="switch" checked={a[clave]} onChange={(e) => {
        cambiar({ [clave]: e.target.checked });
        if (clave === "voz" && e.target.checked) hablar(T("Listo, te leo los tips en voz alta."), idioma());
      }} />
      <span className="interruptor__pista" aria-hidden />
    </label>
  );
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-a11y" onPointerDown={(e) => e.target === e.currentTarget && p.alCerrar()}>
      <div className="modal__caja">
        <div className="modal__cabeza">
          <h2 id="titulo-a11y"><Accessibility size={22} aria-hidden /> {T("Accesibilidad")}</h2>
          <button className="icono" onClick={p.alCerrar} aria-label={T("Cerrar")}><X size={20} /></button>
        </div>
        <p className="modal__ayuda">{T("Ajustá la app a tu gusto. Se guarda en este equipo.")}</p>
        <div className="opciones">
          <fieldset>
            <legend>{T("Tamaño del texto y los botones")}</legend>
            <div className="segmentos segmentos--tamano">
              {([["normal", "A", "Normal"], ["grande", "A", "Grande"], ["muygrande", "A", "Muy grande"]] as const).map(([v, letra, t], i) => (
                <label key={v}>
                  <input type="radio" name="tamano" checked={a.tamano === v} onChange={() => cambiar({ tamano: v })} />
                  <span><b style={{ fontSize: `${1 + i * 0.3}em` }} aria-hidden>{letra}</b> {T(t)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {interruptor("contraste", "Alto contraste", "Colores más fuertes y bordes marcados.")}
          {interruptor("movimiento", "Menos movimiento", "Sin animaciones ni saltos.")}
          {interruptor("espaciado", "Texto más espaciado", "Más aire entre letras y renglones.")}
          {hayVoz() && interruptor("voz", "Labcin lee en voz alta", "Escuchá los tips y avisos.")}
          {hayVoz() && a.voz && (() => {
            const v = mejorVoz(idioma());
            return (
              <p className="modal__ayuda voz-info">
                {v ? <>{T("Voz: {v}", { v: v.name.replace(/^Microsoft\s+/, "").replace(/\s*-\s*.*$/, "") })} · </> : <>{T("No hay ninguna voz instalada para este idioma.")} </>}
                {v && <button type="button" className="enlace" onClick={() => hablar(T("¡Hola! Soy Labcin. Así suena mi voz."), idioma())}>{T("Probar voz")}</button>}
              </p>
            );
          })()}
        </div>
        <p className="modal__ayuda a11y-atajos">{T("Atajos: Ctrl+O abrir · Ctrl+S guardar · Ctrl+Z deshacer · Supr borrar · Esc cancelar · Alt+A accesibilidad")}</p>
      </div>
    </div>
  );
}
