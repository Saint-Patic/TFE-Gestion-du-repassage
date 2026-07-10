import { requeteApi } from './client';
import type { Client, NouveauClient } from './types';

// Crée un client côté backend (le code-barres est généré serveur).
export function creerClient(donnees: NouveauClient): Promise<Client> {
  return requeteApi<Client>('/clients', {
    method: 'POST',
    body: JSON.stringify(donnees),
  });
}
