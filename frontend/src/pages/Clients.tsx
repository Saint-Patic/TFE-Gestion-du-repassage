import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listerClients, modifierClient, supprimerClient } from '../api/clients';
import { imprimerEtiquette } from '../api/agent';
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
  const [erreur, setErreur] = useState<string | null>(null);

  // Le code-barres fait partie de la cible de recherche : c'est parfois la seule chose
  // que la gérante ait sous les yeux, lue sur une étiquette abîmée.
  const filtres = clients.filter((c) => {
    const cible = `${c.nom} ${c.prenom} ${c.telephone} ${c.code_barre}`.toLowerCase();
    return cible.includes(recherche.toLowerCase());
  });

  async function enregistrer(donnees: NouveauClient) {
    if (!aEditer) return;
    await modifierClient(aEditer.id_client, donnees);
    setAEditer(null);
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }

  // Réimpression de l'étiquette d'un client existant. Le code-barres appartient au client
  // et le suit d'une visite à l'autre : une étiquette perdue ou abîmée doit pouvoir être
  // refaite, sinon le client n'est plus scannable du tout.
  async function reimprimer(client: Client) {
    setMessage(null);
    setErreur(null);
    try {
      await imprimerEtiquette(client);
      setMessage(`Étiquette envoyée à l'impression (${client.code_barre}).`);
    } catch {
      setErreur('L’agent d’impression ne répond pas. Est-il démarré sur ce poste ?');
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setMessage(null);
    setErreur(null);
    try {
      const { commandes_detachees } = await supprimerClient(aSupprimer.id_client);
      setMessage(
        commandes_detachees > 0
          ? `Client supprimé — ${commandes_detachees} commande(s) conservées dans les statistiques.`
          : 'Client supprimé.'
      );
    } catch (e) {
      // On affiche le message du serveur tel quel : c'est lui qui connaît le nombre de commandes
      // encore en cours. Le typage par canard évite d'importer ErreurApi ici.
      const corps = (e as { corps?: { message?: string } }).corps;
      setErreur(corps?.message ?? 'Suppression impossible.');
    }
    setASupprimer(null);
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3 rounded-lg bg-white p-4 shadow-sm">
      <h1 className="text-xl font-bold">Clients</h1>
      <input
        className="rounded border p-2"
        placeholder="Rechercher…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />
      {message && <p className="text-green-700">{message}</p>}
      {erreur && <p className="text-red-600">{erreur}</p>}
      <ul className="flex flex-col divide-y">
        {filtres.map((c) => (
          <li key={c.id_client} className="flex items-center justify-between py-2">
            <span className="flex flex-col">
              <span>{c.nom} {c.prenom} — {c.telephone}</span>
              {/* Lisible et sélectionnable : permet la saisie au clavier si l'étiquette
                  est perdue et l'imprimante indisponible. */}
              <span className="font-mono text-xs text-gray-500">{c.code_barre}</span>
            </span>
            <span className="flex gap-2">
              <Link aria-label="Historique du client" className="rounded px-2 py-1" to={`/clients/${c.id_client}/historique`}>🕘</Link>
              <button aria-label="Réimprimer l’étiquette" className="rounded px-2 py-1" onClick={() => reimprimer(c)}>🖨</button>
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
          message={`${aSupprimer.prenom} ${aSupprimer.nom} sera définitivement supprimé. Ses commandes passées restent comptées dans les statistiques.`}
          libelleAction="Supprimer"
          onConfirmer={confirmerSuppression}
          onAnnuler={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
