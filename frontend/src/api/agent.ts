import type { Client } from './types';

// Agent d'impression local (#80), appelé hors proxy /api.
const URL_AGENT = import.meta.env.VITE_URL_AGENT || 'http://localhost:4000';

// Envoie l'étiquette du client à l'agent d'impression local.
export async function imprimerEtiquette(client: Client): Promise<void> {
  const reponse = await fetch(`${URL_AGENT}/imprimer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom: client.nom,
      prenom: client.prenom,
      code_barre: client.code_barre,
    }),
  });
  if (!reponse.ok) {
    throw new Error("L'agent d'impression a renvoyé une erreur.");
  }
}
