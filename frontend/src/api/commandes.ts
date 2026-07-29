import { requeteApi } from './client';
import type { Client, Commande } from './types';

// Recherche un client par son code-barres (encodage d'une réception).
export function rechercherClientParCodeBarre(code: string): Promise<Client> {
  return requeteApi<Client>(`/clients/code-barre/${encodeURIComponent(code)}`);
}

// Crée une commande (réception) : client + nombre de mannes.
export function creerCommande(
  donnees: { id_client: string; nombre_mannes: number }
): Promise<Commande> {
  return requeteApi<Commande>('/commandes', {
    method: 'POST',
    body: JSON.stringify(donnees),
  });
}

// Enregistre la répartition des mannes d'une commande sur les emplacements scannés.
export function placerEmplacements(
  idCommande: string,
  lignes: { id_emplacement: string; nombre_mannes: number }[]
): Promise<void> {
  return requeteApi<void>(`/commandes/${encodeURIComponent(idCommande)}/emplacements`, {
    method: 'POST',
    body: JSON.stringify({ emplacements: lignes }),
  });
}
