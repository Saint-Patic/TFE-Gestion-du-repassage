import { requeteApi } from './client';
import type { Client, NouveauClient } from './types';

// Crée un client côté backend (le code-barres est généré serveur).
export function creerClient(donnees: NouveauClient): Promise<Client> {
  return requeteApi<Client>('/clients', {
    method: 'POST',
    body: JSON.stringify(donnees),
  });
}

// Liste tous les clients (le filtrage se fait côté frontend).
export function listerClients(): Promise<Client[]> {
  return requeteApi<Client[]>('/clients');
}

// Modifie les champs éditables d'un client.
export function modifierClient(id: string, donnees: NouveauClient): Promise<Client> {
  return requeteApi<Client>(`/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(donnees),
  });
}

// Supprime un client (ou l'anonymise s'il a des commandes) ; indique lequel via `anonymise`.
export function supprimerClient(id: string): Promise<{ anonymise: boolean }> {
  return requeteApi<{ anonymise: boolean }>(`/clients/${id}`, { method: 'DELETE' });
}
