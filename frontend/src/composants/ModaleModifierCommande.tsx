import { useState } from 'react';
import type { FormEvent } from 'react';
import { modifierCommande, placerEmplacements } from '../api/commandes';
import type { CommandeCarte, Emplacement } from '../api/types';
import { PlacementMannes } from './PlacementMannes';

type Props = {
  commande: CommandeCarte;
  emplacements: Emplacement[];
  onFerme: () => void;
  onEnregistre: () => void;
};

// Modale d'édition d'une commande « à faire » (flags + nombre de mannes).
// Si le nombre de mannes change, enchaîne la phase de placement (#160) avant de fermer.
export function ModaleModifierCommande({ commande, emplacements, onFerme, onEnregistre }: Props) {
  const [mannes, setMannes] = useState(String(commande.nombre_mannes));
  const [prioritaire, setPrioritaire] = useState(commande.prioritaire);
  const [cintresClient, setCintresClient] = useState(commande.cintres_client);
  const [cintresEntrRendus, setCintresEntrRendus] = useState(commande.cintres_entr_rendus);
  const [phase, setPhase] = useState<'edition' | 'placement'>('edition');
  const [nouveauN, setNouveauN] = useState(commande.nombre_mannes);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    const nb = Number(mannes);
    if (!Number.isInteger(nb) || nb < 1) {
      setErreur('Le nombre de mannes doit être un entier ≥ 1.');
      return;
    }
    setErreur(null);
    try {
      await modifierCommande(commande.id_commande, {
        nombre_mannes: nb,
        prioritaire,
        cintres_client: cintresClient,
        cintres_entr_rendus: cintresEntrRendus,
      });
      if (nb === commande.nombre_mannes) {
        onEnregistre();
        onFerme();
      } else {
        setNouveauN(nb);
        setPhase('placement');
      }
    } catch {
      setErreur('Impossible d’enregistrer la commande.');
    }
  }

  async function terminerPlacement(lignes: { id_emplacement: string; nombre_mannes: number }[]) {
    setErreur(null);
    try {
      await placerEmplacements(commande.id_commande, lignes);
      onEnregistre();
      onFerme();
    } catch {
      setErreur('Impossible d’enregistrer les emplacements.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog" aria-modal="true">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-4 shadow-lg">
        <h2 className="text-lg font-bold">Modifier la commande</h2>
        {erreur && <p className="text-red-700">{erreur}</p>}

        {phase === 'edition' && (
          <form onSubmit={enregistrer} className="flex flex-col gap-3">
            <label htmlFor="mannes-modif" className="font-semibold">Nombre de mannes</label>
            <input id="mannes-modif" className="rounded border p-2" type="number" min={1}
              value={mannes} onChange={(e) => setMannes(e.target.value)} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={prioritaire} onChange={(e) => setPrioritaire(e.target.checked)} />
              Prioritaire
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={cintresClient} onChange={(e) => setCintresClient(e.target.checked)} />
              Cintres client
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={cintresEntrRendus} onChange={(e) => setCintresEntrRendus(e.target.checked)} />
              Cintres entreprise rendus
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded px-4 py-2" onClick={onFerme}>Annuler</button>
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">Enregistrer</button>
            </div>
          </form>
        )}

        {phase === 'placement' && (
          <PlacementMannes nombreMannes={nouveauN} emplacements={emplacements} onTerminer={terminerPlacement} />
        )}
      </div>
    </div>
  );
}
