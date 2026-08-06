import { requeteApi } from './client';
import type { Emplacement, ContenuEmplacement } from './types';

// Liste les emplacements (étagères + sol) avec le client occupant. Préchargement des écrans.
export function listerEmplacements(): Promise<Emplacement[]> {
  return requeteApi<Emplacement[]>('/emplacements');
}

// Contenu d'un emplacement (réorganisation).
export function contenuEmplacement(id: string): Promise<ContenuEmplacement[]> {
  return requeteApi<ContenuEmplacement[]>(`/emplacements/${id}/contenu`);
}

// Déplace les mannes d'un client d'une source vers une destination.
export function deplacerEmplacement(
  idSource: string,
  idDestination: string,
  idClient: string
): Promise<void> {
  return requeteApi<void>('/emplacements/deplacer', {
    method: 'POST',
    body: JSON.stringify({ id_source: idSource, id_destination: idDestination, id_client: idClient }),
  });
}
