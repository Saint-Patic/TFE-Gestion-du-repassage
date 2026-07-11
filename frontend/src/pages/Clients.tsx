import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listerClients, modifierClient, supprimerClient } from '../api/clients';
import type { Client, NouveauClient } from '../api/types';
import { ModaleClient } from '../composants/ModaleClient';
import { ModaleConfirmation } from '../composants/ModaleConfirmation';

export function Clients() {
  const queryClient = useQueryClient();
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: listerClients });
  const [recherche, setRecherche] = useState('');
  const [aEditer, setAEditer] = useState<Client | null>(null);
  const [aSupprimer, setASupprimer] = useState<Client | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filtres = clients.filter((c) => {
    const cible = `${c.nom} ${c.prenom} ${c.telephone}`.toLowerCase();
    return cible.includes(recherche.toLowerCase());
  });

  async function enregistrer(donnees: NouveauClient) {
    if (!aEditer) return;
    await modifierClient(aEditer.id_client, donnees);
    setAEditer(null);
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    const { anonymise } = await supprimerClient(aSupprimer.id_client);
    setMessage(anonymise ? 'Client anonymisé (commandes conservées).' : 'Client supprimé.');
    setASupprimer(null);
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <h1 className="text-xl font-bold">Clients</h1>
      <input
        className="rounded border p-2"
        placeholder="Rechercher…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />
      {message && <p className="text-green-700">{message}</p>}
      <ul className="flex flex-col divide-y">
        {filtres.map((c) => (
          <li key={c.id_client} className="flex items-center justify-between py-2">
            <span>{c.nom} {c.prenom} — {c.telephone}</span>
            <span className="flex gap-2">
              <button aria-label="Modifier le client" className="rounded px-2 py-1" onClick={() => setAEditer(c)}>✎</button>
              <button aria-label="Supprimer le client" className="rounded px-2 py-1 text-red-600" onClick={() => setASupprimer(c)}>✕</button>
            </span>
          </li>
        ))}
      </ul>

      {aEditer && (
        <ModaleClient client={aEditer} onEnregistrer={enregistrer} onAnnuler={() => setAEditer(null)} />
      )}
      {aSupprimer && (
        <ModaleConfirmation
          titre="Supprimer ce client ?"
          message={`${aSupprimer.prenom} ${aSupprimer.nom} sera supprimé (ou anonymisé s'il a des commandes).`}
          libelleAction="Supprimer"
          onConfirmer={confirmerSuppression}
          onAnnuler={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
