import { useState } from "react";
import { Scaling } from "lucide-react";
import { T } from "../i18n";

export type OpcionesAjuste = { tamano: "a4" | "carta"; margen: number; orientacion: "auto" | "vertical" };

const CM = 28.3465;

export default function AjustarPaginas(p: { alAceptar: (o: OpcionesAjuste) => void; alCancelar: () => void }) {
  const [o, setO] = useState<OpcionesAjuste>({ tamano: "a4", margen: 0, orientacion: "auto" });
  const grupo = <K extends keyof OpcionesAjuste>(clave: K, titulo: string, valores: { v: OpcionesAjuste[K]; t: string }[]) => (
    <fieldset>
      <legend>{T(titulo)}</legend>
      <div className="segmentos">
        {valores.map((x) => (
          <label key={String(x.v)}>
            <input type="radio" name={clave} checked={o[clave] === x.v} onChange={() => setO({ ...o, [clave]: x.v })} />
            <span>{T(x.t)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  const m = (o.margen / CM) * 4; // margen dibujado en la vista previa
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-ajustar" onPointerDown={(e) => e.target === e.currentTarget && p.alCancelar()}>
      <div className="modal__caja">
        <h2 id="titulo-ajustar"><Scaling size={20} aria-hidden /> {T("Ajustar páginas")}</h2>
        <p>{T("Todas las páginas quedan del mismo tamaño, sin perder calidad. Las anotaciones quedan fijas en la página.")}</p>
        <div className="vista-hoja" aria-hidden>
          <i style={{ width: 52, height: 74, ["--m" as string]: `${m}px` }} />
          {o.orientacion === "auto" && <i style={{ width: 74, height: 52, ["--m" as string]: `${m}px` }} />}
        </div>
        <div className="opciones">
          {grupo("tamano", "Tamaño", [{ v: "a4", t: "A4" }, { v: "carta", t: "Carta" }])}
          {grupo("margen", "Márgenes", [{ v: 0, t: "Sin márgenes" }, { v: CM, t: "Chicos (1 cm)" }, { v: 2 * CM, t: "Medianos (2 cm)" }])}
          {grupo("orientacion", "Orientación", [{ v: "auto", t: "Según cada página" }, { v: "vertical", t: "Todas verticales" }])}
        </div>
        <div className="modal__botones">
          <span className="espacio" />
          <button className="boton boton--suave" onClick={p.alCancelar}>{T("Cancelar")}</button>
          <button className="boton boton--primario" onClick={() => p.alAceptar(o)}>{T("Ajustar")}</button>
        </div>
      </div>
    </div>
  );
}
