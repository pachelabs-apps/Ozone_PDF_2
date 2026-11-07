import { useState } from "react";
import { Scaling } from "lucide-react";
import { T } from "../i18n";

export type OpcionesAjuste = { tamano: "a4" | "carta" | "original"; margen: number; orientacion: "auto" | "vertical" };

const CM = 28.3465;

export default function AjustarPaginas(p: { alAceptar: (o: OpcionesAjuste) => void; alCancelar: () => void }) {
  const [tamano, setTamano] = useState<OpcionesAjuste["tamano"]>("a4");
  const [orientacion, setOrientacion] = useState<OpcionesAjuste["orientacion"]>("auto");
  const [modoMargen, setModoMargen] = useState<"0" | "1" | "2" | "otro">("0");
  const [cm, setCm] = useState("1,5");
  const cmNum = Number(cm.replace(",", "."));
  const cmValido = Number.isFinite(cmNum) && cmNum >= 0.5 && cmNum <= 5;
  const margenCm = modoMargen === "otro" ? (cmValido ? cmNum : 0) : Number(modoMargen);
  const nadaQueHacer = tamano === "original" && margenCm === 0 && orientacion === "auto";

  function grupo<V extends string>(nombre: string, titulo: string, valor: V, alCambiar: (v: V) => void, valores: { v: V; t: string }[]) {
    return (
      <fieldset>
        <legend>{T(titulo)}</legend>
        <div className="segmentos">
          {valores.map((x) => (
            <label key={x.v}>
              <input type="radio" name={nombre} checked={valor === x.v} onChange={() => alCambiar(x.v)} />
              <span>{T(x.t)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  const m = margenCm * 4; // margen dibujado en la vista previa
  const ayuda = tamano === "original"
    ? orientacion === "vertical" ? "Cada página conserva su tamaño. Las que están acostadas se giran para quedar paradas." : "Cada página conserva su tamaño; solo se agregan los márgenes."
    : "Todas las páginas quedan del mismo tamaño, sin perder calidad. Las anotaciones quedan fijas en la página.";
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-ajustar" onPointerDown={(e) => e.target === e.currentTarget && p.alCancelar()}>
      <div className="modal__caja">
        <h2 id="titulo-ajustar"><Scaling size={20} aria-hidden /> {T("Ajustar páginas")}</h2>
        <p>{T(ayuda)}</p>
        <div className="vista-hoja" aria-hidden>
          <i style={{ width: 52, height: 74, ["--m" as string]: `${m}px` }} />
          {orientacion === "auto" && <i style={{ width: 74, height: 52, ["--m" as string]: `${m}px` }} />}
        </div>
        <div className="opciones">
          {grupo("tamano", "Tamaño", tamano, setTamano, [{ v: "a4", t: "A4" }, { v: "carta", t: "Carta" }, { v: "original", t: "No cambiar el tamaño" }])}
          {grupo("margen", "Márgenes", modoMargen, setModoMargen, [{ v: "0", t: "Sin márgenes" }, { v: "1", t: "1 cm" }, { v: "2", t: "2 cm (sugerido)" }, { v: "otro", t: "Otro" }])}
          {modoMargen === "otro" && (
            <label className="campo-etiqueta">{T("Margen en cm (de 0,5 a 5)")}
              <input className="campo campo--chico" inputMode="decimal" value={cm} autoFocus onChange={(e) => setCm(e.target.value.replace(/[^\d.,]/g, ""))} aria-invalid={!cmValido} />
              {!cmValido && <small className="error">{T("Poné un número entre 0,5 y 5.")}</small>}
            </label>
          )}
          {grupo("orientacion", "Orientación", orientacion, setOrientacion, [{ v: "auto", t: "Según cada página" }, { v: "vertical", t: "Todas verticales" }])}
        </div>
        <div className="modal__botones">
          <span className="espacio" />
          <button className="boton boton--suave" onClick={p.alCancelar}>{T("Cancelar")}</button>
          <button className="boton boton--primario" disabled={nadaQueHacer || (modoMargen === "otro" && !cmValido)}
            onClick={() => p.alAceptar({ tamano, margen: margenCm * CM, orientacion })}>{T("Ajustar")}</button>
        </div>
      </div>
    </div>
  );
}
