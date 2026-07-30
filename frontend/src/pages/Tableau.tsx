import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listerCommandes } from '../api/commandes';
import { listerEmplacements } from '../api/emplacements';
import type { CommandeCarte, Emplacement } from '../api/types';
import { CarteCommande } from '../composants/CarteCommande';
import { ModaleModifierCommande } from '../composants/ModaleModifierCommande';

const COLONNES: { statut: CommandeCarte['statut']; titre: string }[] = [
  { statut: 'a_faire', titre: 'À faire' },
  { statut: 'en_cours', titre: 'En cours' },
  { statut: 'fait', titre: 'Fait' },
];

export function Tableau() {
  const queryClient = useQueryClient();
  const { data: commandes = [] } = useQuery({ queryKey: ['commandes'], queryFn: listerCommandes });
  const [emplacements, setEmplacements] = useState<Emplacement[]>([]);
  const [aModifier, setAModifier] = useState<CommandeCarte | null>(null);

  // Préchargement des 42 emplacements pour la modale de re-placement.
  useEffect(() => {
    listerEmplacements().then(setEmplacements).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">Tableau des commandes</h1>
      <div className="flex gap-4 overflow-x-auto">
        {COLONNES.map((col) => (
          <div key={col.statut} className="flex min-w-[12rem] flex-col gap-2">
            <h2 className="font-semibold">{col.titre}</h2>
            {commandes.filter((c) => c.statut === col.statut).map((c) => (
              <CarteCommande key={c.id_commande} commande={c} onModifier={setAModifier} />
            ))}
          </div>
        ))}
      </div>

      {aModifier && (
        <ModaleModifierCommande
          commande={aModifier}
          emplacements={emplacements}
          onFerme={() => setAModifier(null)}
          onEnregistre={() => queryClient.invalidateQueries({ queryKey: ['commandes'] })}
        />
      )}
    </div>
  );
}
