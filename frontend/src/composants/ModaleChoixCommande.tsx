import type { CommandeAScanner } from '../api/types';

type Props = {
  commandes: CommandeAScanner[];
  onChoisir: (commande: CommandeAScanner) => void;
  onAnnuler: () => void;
};

// Verbe affiché sur la ligne, par action à venir.
const VERBES: Record<CommandeAScanner['action'], string> = {
  demarrer: 'Démarrer',
  cloturer: 'Clôturer',
  recuperer: 'Remettre',
};

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-BE');

// Choix de la commande à traiter quand un client en a plusieurs au scan.
export function ModaleChoixCommande({ commandes, onChoisir, onAnnuler }: Props) {
  const premiere = commandes[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
        <h2 className="text-lg font-bold">
          {commandes.length} commandes pour {premiere.client_prenom} {premiere.client_nom}
        </h2>

        <ul className="mt-3 flex flex-col gap-2">
          {commandes.map((c) => (
            <li key={c.id_commande}>
              <button
                type="button"
                className={`w-full rounded border p-3 text-left ${
                  c.prioritaire ? 'border-red-500 bg-red-50' : ''
                }`}
                onClick={() => onChoisir(c)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{VERBES[c.action]}</span>
                  {c.prioritaire && (
                    <span className="rounded bg-red-100 px-1 text-xs text-red-700">Prioritaire</span>
                  )}
                </span>
                <span className="block text-sm">
                  {c.nombre_mannes} manne{c.nombre_mannes > 1 ? 's' : ''} · reçue le {dateFr(c.date_reception)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className="mt-3 underline" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </div>
  );
}
