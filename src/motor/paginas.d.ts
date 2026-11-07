export const TAMANOS: Record<string, [number, number]>;
export function ajustarPaginas(mupdf: any, doc: any, opciones: { tamano: string; margen: number; orientacion: string }): number;
export function agregarImagenes(mupdf: any, doc: any, imagenes: Uint8Array[], opciones: { tamano: string; margen: number }): void;
