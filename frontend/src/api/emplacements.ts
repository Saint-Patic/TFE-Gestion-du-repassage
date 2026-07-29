import { requeteApi } from './client';
import type { Emplacement } from './types';

// Liste les 42 emplacements (préchargement de l'écran d'encodage).
export function listerEmplacements(): Promise<Emplacement[]> {
  return requeteApi<Emplacement[]>('/emplacements');
}
