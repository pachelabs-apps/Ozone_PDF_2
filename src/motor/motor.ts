// Puente entre la pantalla y el motor PDF (que corre en un Worker local).
export type Rect = [number, number, number, number];
export type Punto = [number, number];
export type InfoPagina = { w: number; h: number; x0: number; y0: number };
export type Seguridad = {
  firma: null | "valida" | "alterada";
  cifrado: boolean;
  restringido: boolean; // el autor no permite modificarlo
  permisos: { editar: boolean; anotar: boolean; copiar: boolean; imprimir: boolean };
  adjuntos: number;
};
export type InfoDoc = { paginas: InfoPagina[]; titulo: string; seguridad?: Seguridad };
export type Anotacion = { id: number; tipo: string; r: Rect; movible?: boolean; redimensionable?: boolean };

type Pendiente = { ok: (v: any) => void; mal: (e: Error) => void };

class Motor {
  private w: Worker;
  private n = 0;
  private pendientes = new Map<number, Pendiente>();
  listo: Promise<void>;

  constructor() {
    this.w = new Worker(new URL("./motor.worker.ts", import.meta.url), { type: "module" });
    let avisar!: () => void;
    this.listo = new Promise((r) => (avisar = r));
    this.w.onmessage = (e) => {
      const m = e.data;
      if (m.listo) return avisar();
      const p = this.pendientes.get(m.id);
      if (!p) return;
      this.pendientes.delete(m.id);
      m.ok ? p.ok(m.r) : p.mal(new Error(m.error));
    };
  }

  private async pedir<T>(op: string, args?: any, transferir: Transferable[] = []): Promise<T> {
    await this.listo;
    const id = ++this.n;
    return new Promise<T>((ok, mal) => {
      this.pendientes.set(id, { ok, mal });
      this.w.postMessage({ id, op, args }, transferir);
    });
  }

  abrir(datos: ArrayBuffer) {
    return this.pedir<InfoDoc | { necesitaClave: true }>("abrir", { datos }, [datos]);
  }
  clave(clave: string) {
    return this.pedir<InfoDoc | { incorrecta: true }>("clave", { clave });
  }
  render(pagina: number, escala: number) {
    return this.pedir<{ w: number; h: number; pixeles: Uint8ClampedArray }>("render", { pagina, escala });
  }
  anotaciones(pagina: number) {
    return this.pedir<Anotacion[]>("anotaciones", { pagina });
  }
  resaltar(pagina: number, a: Punto, b: Punto, color: number[], tipo = "Highlight") {
    return this.pedir<Anotacion | null>("resaltar", { pagina, a, b, color, tipo });
  }
  texto(pagina: number, x: number, y: number, texto: string, tam: number, color: number[]) {
    return this.pedir<Anotacion>("texto", { pagina, x, y, texto, tam, color });
  }
  rectangulo(pagina: number, r: Rect, color: number[]) {
    return this.pedir<Anotacion>("rectangulo", { pagina, r, color });
  }
  tinta(pagina: number, trazos: Punto[][], color: number[], ancho: number) {
    return this.pedir<Anotacion>("tinta", { pagina, trazos, color, ancho });
  }
  firma(pagina: number, r: Rect, png: Uint8Array) {
    return this.pedir<Anotacion>("firma", { pagina, r, png });
  }
  censurar(pagina: number, r: Rect) {
    return this.pedir<Anotacion>("censurar", { pagina, r });
  }
  aplicarCensura() {
    return this.pedir<number[]>("aplicarCensura");
  }
  censurasPendientes() {
    return this.pedir<number>("censurasPendientes");
  }
  mover(pagina: number, id: number, dx: number, dy: number) {
    return this.pedir<Anotacion>("mover", { pagina, id, dx, dy });
  }
  ajustar(pagina: number, id: number, r: Rect) {
    return this.pedir<Anotacion>("ajustar", { pagina, id, r });
  }
  borrar(pagina: number, id: number) {
    return this.pedir<boolean>("borrar", { pagina, id });
  }
  ajustarPaginas(tamano: string, margen: number, orientacion: string) {
    return this.pedir<InfoDoc & { cambiadas: number }>("ajustarPaginas", { tamano, margen, orientacion });
  }
  desdeImagenes(imagenes: Uint8Array[], anexar: boolean) {
    return this.pedir<InfoDoc>("desdeImagenes", { imagenes, anexar }, imagenes.map((i) => i.buffer as ArrayBuffer));
  }
  tamanosMezclados() {
    return this.pedir<boolean>("tamanosMezclados");
  }
  cerrar() { return this.pedir<boolean>("cerrar"); }
  instantanea() { return this.pedir<boolean>("instantanea"); }
  restaurar() { return this.pedir<InfoDoc>("restaurar"); }
  olvidarInstantaneas() { return this.pedir<boolean>("olvidarInstantaneas"); }
  rotarPagina(i: number, grados: number) { return this.pedir<InfoDoc>("rotarPagina", { i, grados }); }
  moverPagina(de: number, a: number) { return this.pedir<InfoDoc>("moverPagina", { de, a }); }
  borrarPaginas(indices: number[]) { return this.pedir<InfoDoc>("borrarPaginas", { indices }); }
  rotarRangos(rangos: string, grados: number) { return this.pedir<InfoDoc & { cambiadas: number }>("rotarRangos", { rangos, grados }); }
  borrarRangos(rangos: string) { return this.pedir<InfoDoc & { cambiadas: number }>("borrarRangos", { rangos }); }
  reordenar(orden: string, invertir = false) { return this.pedir<InfoDoc>("reordenar", { orden, invertir }); }
  unir(archivos: Uint8Array[]) { return this.pedir<InfoDoc>("unir", { archivos }, archivos.map((a) => a.buffer as ArrayBuffer)); }
  dividir(modo: string, valor: any) {
    return this.pedir<{ partes: { paginas: number; desde: number; hasta: number; datos: Uint8Array }[] }>("dividir", { modo, valor });
  }
  extraer(rangos: string) { return this.pedir<{ datos: Uint8Array; paginas: number }>("extraer", { rangos }); }
  comprimir(nivel: string) {
    return this.pedir<InfoDoc & { antes: number; despues: number; imagenes: number; achicadas: number }>("comprimir", { nivel });
  }
  tamanoActual() { return this.pedir<number>("tamanoActual"); }
  marcaDeAgua(png: Uint8Array, escala: number) { return this.pedir<InfoDoc>("marcaDeAgua", { png, escala }); }
  numerar(o: { posicion: string; formato: string; tam: number; desde: number }) { return this.pedir<InfoDoc>("numerar", o); }
  limpiarDatos() { return this.pedir<{ notas: number }>("limpiarDatos"); }
  aImagenes(dpi: number, formato: string) { return this.pedir<{ lista: { pagina: number; datos: Uint8Array }[] }>("aImagenes", { dpi, formato }); }
  aTexto() { return this.pedir<string[]>("aTexto"); }
  guardar(o: { clave?: string; quitarClave?: boolean } = {}) {
    return this.pedir<{ datos: Uint8Array }>("guardar", o);
  }
}

export const motor = new Motor();

// Un segundo motor, aparte, para las herramientas rápidas: así nunca tocan el PDF abierto en el editor.
let aparte: Motor | null = null;
export function motorAparte() { return (aparte ??= new Motor()); }
