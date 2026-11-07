export type LabcinApi = {
  saludar: () => Promise<void>;
  reir: () => Promise<void>;
  romper: () => void;
  festejar: () => Promise<void>;
  hablar: () => void;
  ocupado: () => boolean;
};
export function montarLabcin(cont: HTMLElement, opciones?: { alTocar?: () => void }): LabcinApi;
