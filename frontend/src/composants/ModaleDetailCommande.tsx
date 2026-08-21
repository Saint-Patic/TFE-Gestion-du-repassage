import type { CommandeCarte } from '../api/types';
import { Chrono } from './Chrono';

type Props = {
  commande: CommandeCarte;
  onFermer: () => void;
  onPause?: (commande: CommandeCarte) => void;
  onReprendre?: (commande: CommandeCarte) => void;
};

// Libellé d'un statut de commande (ceux des colonnes du Kanban diffèrent).
const LIBELLES_STATUT: Record<CommandeCarte['statut'], string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  fait: 'Fait',
  recupere: 'Récupéré',
};

// « A1G (1), B2C (2) », ou un tiret si la commande n'occupe aucun emplacement.
function formaterEmplacements(commande: CommandeCarte): string {
  const liste = commande.emplacements ?? [];
  if (liste.length === 0) return '—';
  return liste.map((e) => `${e.code_barre} (${e.nombre_mannes})`).join(', ');
}

// Vue détaillée en lecture d'une commande, ouverte au clic sur sa carte du Kanban.
export function ModaleDetailCommande({ commande, onFermer, onPause, onReprendre }: Props) {
  const enCours = commande.statut === 'en_cours';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full max-w-md rounded-lg bg-white p-4 shadow-lg ${
          commande.prioritaire ? 'border-2 border-red-500 bg-red-50' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold">
            {commande.client_prenom} {commande.client_nom}
          </h2>
          <button type="button" aria-label="Fermer" className="px-2 text-xl leading-none" onClick={onFermer}>
            ✕
          </button>
        </div>

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-semibold">Statut</dt>
          <dd>{LIBELLES_STATUT[commande.statut]}</dd>
          <dt className="font-semibold">Mannes</dt>
          <dd>{commande.nombre_mannes}</dd>
          <dt className="font-semibold">Repasseuse</dt>
          <dd>{commande.repasseuse_nom ?? 'Non attribuée'}</dd>
          <dt className="font-semibold">Emplacement</dt>
          <dd>{formaterEmplacements(commande)}</dd>
        </dl>

        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="text-4xl">
            <Chrono debut={commande.repassage_debut} cumul={commande.temps_repassage_s} />
          </div>
          {enCours && commande.repassage_debut && onPause && (
            <button type="button" className="rounded border px-4 py-2" onClick={() => onPause(commande)}>
              Pause
            </button>
          )}
          {enCours && !commande.repassage_debut && onReprendre && (
            <button type="button" className="rounded border px-4 py-2" onClick={() => onReprendre(commande)}>
              Reprendre
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-1">
          {commande.prioritaire && (
            <span className="rounded bg-red-100 px-1 text-xs text-red-700">Prioritaire</span>
          )}
          {commande.cintres_client && (
            <span className="rounded bg-blue-100 px-1 text-xs text-blue-700">Cintres client</span>
          )}
          {commande.cintres_entr_rendus && (
            <span className="rounded bg-blue-100 px-1 text-xs text-blue-700">Cintres entr. rendus</span>
          )}
        </div>
      </div>
    </div>
  );
}
