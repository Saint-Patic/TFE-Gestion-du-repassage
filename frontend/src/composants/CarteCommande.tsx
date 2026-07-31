import type { CommandeCarte } from '../api/types';
import { Chrono } from './Chrono';

type Props = {
  commande: CommandeCarte;
  onModifier?: (commande: CommandeCarte) => void;
};

// Carte d'une commande dans le tableau. « Modifier » réservé au statut « à faire ».
export function CarteCommande({ commande, onModifier }: Props) {
  return (
    <div className={`flex flex-col gap-1 rounded border p-2 ${commande.prioritaire ? 'border-red-500 bg-red-50' : ''}`}>
      <span className="font-semibold">{commande.client_prenom} {commande.client_nom}</span>
      <span>{commande.nombre_mannes} manne(s)</span>
      {commande.statut === 'en_cours' && (
        <Chrono debut={commande.repassage_debut} cumul={commande.temps_repassage_s} />
      )}
      <span className="flex flex-wrap gap-1">
        {commande.prioritaire && (
          <span className="rounded bg-red-100 px-1 text-xs text-red-700">Prioritaire</span>
        )}
        {commande.cintres_client && (
          <span className="rounded bg-blue-100 px-1 text-xs text-blue-700">Cintres client</span>
        )}
        {commande.cintres_entr_rendus && (
          <span className="rounded bg-blue-100 px-1 text-xs text-blue-700">Cintres entr. rendus</span>
        )}
      </span>
      {commande.statut === 'a_faire' && onModifier && (
        <button type="button" className="self-start rounded border px-2 py-1"
          onClick={() => onModifier(commande)}>
          Modifier
        </button>
      )}
    </div>
  );
}
