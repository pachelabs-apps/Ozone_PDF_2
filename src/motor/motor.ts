// Puente entre la pantalla y el motor PDF (que corre en un Worker local).
export type Rect = [number, number, number, number];
export type Punto = [number, number];
export type InfoPagina = { w: number; h: number; x0: number; y0: number };
export type InfoDoc = { paginas: InfoPagina[]; titulo: string };
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
  guardar() {
    return this.pedir<{ datos: Uint8Array }>("guardar");
  }
}

export const motor = new Motor();
