// Constantes que Vite reemplaza al compilar (vite.config.ts).
declare const __VERSION__: string;

// mammoth (Word → HTML) se carga recién cuando se usa "Word a PDF"
declare module "mammoth/mammoth.browser.min.js" {
  const mammoth: unknown;
  export default mammoth;
}
