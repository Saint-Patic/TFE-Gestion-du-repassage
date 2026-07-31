import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listerCommandes, demarrerRepassage, mettreEnPause, reprendreRepassage, definirCintresEntreprise } from '../api/commandes';
import { listerEmplacements } from '../api/emplacements';
import { obtenirSocket } from '../temps-reel/socket';
import { useAuth } from '../auth/AuthContext';
import { ErreurApi } from '../api/client';
import type { CommandeCarte, Emplacement } from '../api/types';
import { CarteCommande } from '../composants/CarteCommande';
import { ModaleModifierCommande } from '../composants/ModaleModifierCommande';

const COLONNES: { statut: CommandeCarte['statut']; titre: string }[] = [
  { statut: 'a_faire', titre: 'À faire' },
  { statut: 'en_cours', titre: 'En cours' },
  { statut: 'fait', titre: 'Fait' },
  { statut: 'recupere', titre: 'Récupéré' },
];

export function Tableau() {
  const queryClient = useQueryClient();
  const { utilisateur } = useAuth();
  const estRepasseuse = utilisateur?.role === 'repasseuse';
  const { data: commandes = [] } = useQuery({ queryKey: ['commandes'], queryFn: listerCommandes });
  const [emplacements, setEmplacements] = useState<Emplacement[]>([]);
  const [aModifier, setAModifier] = useState<CommandeCarte | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const champScan = useRef<HTMLInputElement>(null);

  // Préchargement des 42 emplacements pour la modale de re-placement.
  useEffect(() => {
    listerEmplacements().then(setEmplacements).catch(() => {});
  }, []);

  // Temps réel : refetch quand une commande concernée change.
  useEffect(() => {
    const socket = obtenirSocket();
    if (!socket) return;
    const handler = () => queryClient.invalidateQueries({ queryKey: ['commandes'] });
    socket.on('commandes:maj', handler);
    return () => { socket.off('commandes:maj', handler); };
  }, [queryClient]);

  async function demarrer(e: FormEvent) {
    e.preventDefault();
    const valeur = code.trim();
    setCode('');
    if (!valeur) return;
    setMessage(null);
    try {
      await demarrerRepassage(valeur);
      // le Kanban se rafraîchit via le socket commandes:maj
    } catch (err) {
      if (err instanceof ErreurApi && err.statut === 404) {
        setMessage('Aucune commande à faire pour ce client.');
      } else {
        setMessage('Erreur lors du démarrage du repassage.');
      }
    }
  }

  // Pause / reprise du timer (repasseuse) ; le Kanban se rafraîchit via le socket.
  function pause(c: CommandeCarte) { mettreEnPause(c.id_commande).catch(() => {}); }
  function reprendre(c: CommandeCarte) { reprendreRepassage(c.id_commande).catch(() => {}); }
  function cintres(c: CommandeCarte, nb: number) { definirCintresEntreprise(c.id_commande, nb).catch(() => {}); }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">Tableau des commandes</h1>

      {estRepasseuse && (
        <form onSubmit={demarrer} className="flex flex-col gap-1">
          <label htmlFor="scan-repassage" className="font-semibold">Démarrer un repassage</label>
          <input
            id="scan-repassage"
            ref={champScan}
            className="max-w-xs rounded border p-2"
            placeholder="Scanner le client"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {message && <p className="text-red-700">{message}</p>}
        </form>
      )}

      <div className="flex gap-4 overflow-x-auto">
        {COLONNES.map((col) => (
          <div key={col.statut} className="flex min-w-[12rem] flex-col gap-2">
            <h2 className="font-semibold">{col.titre}</h2>
            {commandes.filter((c) => c.statut === col.statut).map((c) => (
              <CarteCommande key={c.id_commande} commande={c} onModifier={setAModifier}
                onPause={estRepasseuse ? pause : undefined}
                onReprendre={estRepasseuse ? reprendre : undefined}
                onCintresEntreprise={estRepasseuse ? cintres : undefined} />
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
