import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { historiqueClient } from '../api/clients';
import { formaterHMS } from '../composants/Chrono';

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-BE');
const dateHeureFr = (iso: string) => new Date(iso).toLocaleString('fr-BE');

// Historique d'un client : une ligne par commande, dépliable sur sa chronologie de statuts.
// Écran de la gérante, pensé pour répondre à une contestation (#290).
export function HistoriqueClient() {
  const { id = '' } = useParams();
  const [deplie, setDeplie] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['historique', id], queryFn: () => historiqueClient(id) });

  if (!data) return <p>Chargement…</p>;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm">
      <h1 className="text-xl font-bold">
        Historique — {data.client.prenom} {data.client.nom}
      </h1>
      <Link to="/clients" className="self-start underline">Retour aux clients</Link>

      {data.commandes.length === 0 && <p>Ce client n'a aucune commande.</p>}

      <ul className="flex flex-col gap-2">
        {data.commandes.map((c) => (
          <li key={c.id_commande} className="rounded border p-2">
            <button
              type="button"
              className="flex w-full flex-col items-start text-left"
              onClick={() => setDeplie(deplie === c.id_commande ? null : c.id_commande)}
            >
              <span className="font-semibold">
                {dateFr(c.date_reception)} — {c.nombre_mannes} manne(s) — {c.statut}
              </span>
              <span className="text-sm">
                Repassage : {formaterHMS(c.temps_repassage_s)}
                {c.date_recuperation && ` · Récupéré le ${dateFr(c.date_recuperation)}`}
              </span>
            </button>

            {deplie === c.id_commande && (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {c.evenements.length === 0 && <li>Aucun changement de statut enregistré.</li>}
                {c.evenements.map((e, i) => (
                  <li key={i}>
                    {e.ancien_statut ?? '—'} → {e.nouveau_statut}, le {dateHeureFr(e.horodatage)}, par {e.utilisateur}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
