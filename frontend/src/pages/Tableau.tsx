import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listerCommandes, demarrerRepassage, mettreEnPause, reprendreRepassage, definirCintresEntreprise, resoudreScan, cloturerRepassage, marquerRecuperee } from '../api/commandes';
import { listerEmplacements } from '../api/emplacements';
import { obtenirSocket } from '../temps-reel/socket';
import { useAuth } from '../auth/AuthContext';
import { ErreurApi } from '../api/client';
import type { Commande, CommandeAScanner, CommandeCarte, Emplacement } from '../api/types';
import { CarteCommande } from '../composants/CarteCommande';
import { ModaleModifierCommande } from '../composants/ModaleModifierCommande';
import { ModaleConfirmation } from '../composants/ModaleConfirmation';
import { ModaleDetailCommande } from '../composants/ModaleDetailCommande';
import { ModaleChoixCommande } from '../composants/ModaleChoixCommande';
import { PlacementMannes } from '../composants/PlacementMannes';
import { ReceptionArrivee } from '../composants/ReceptionArrivee';
import { ReorganisationEmplacements } from '../composants/ReorganisationEmplacements';

const COLONNES: { statut: CommandeCarte['statut']; titre: string }[] = [
  { statut: 'a_faire', titre: 'À faire' },
  { statut: 'en_cours', titre: 'En cours' },
  { statut: 'fait', titre: 'Fait' },
  // « aujourd'hui » n'est pas décoratif : le serveur ne renvoie que les remises du jour
  // (`date_recuperation::date = CURRENT_DATE`). Sans cette mention, la disparition des
  // remises de la veille à minuit passerait pour une perte de données.
  { statut: 'recupere', titre: 'Récupéré (aujourd’hui)' },
];

// Un seul panneau à la fois : le typage interdit que deux cibles de scan coexistent.
type Panneau =
  | { type: 'cloture'; commande: Commande }
  | { type: 'reception' }
  | { type: 'reorganisation' }
  | null;

export function Tableau() {
  const queryClient = useQueryClient();
  const { utilisateur } = useAuth();
  const estRepasseuse = utilisateur?.role === 'repasseuse';
  const { data: commandes = [] } = useQuery({ queryKey: ['commandes'], queryFn: listerCommandes });
  const [emplacements, setEmplacements] = useState<Emplacement[]>([]);
  const [aModifier, setAModifier] = useState<CommandeCarte | null>(null);
  // Seul l'identifiant est mémorisé : la commande est redérivée de la liste à chaque rendu,
  // ce qui garde la modale à jour et la ferme si la commande quitte le tableau.
  const [idDetail, setIdDetail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const champScan = useRef<HTMLInputElement>(null);
  const detail = commandes.find((c) => c.id_commande === idDetail);
  const [panneau, setPanneau] = useState<Panneau>(null);
  const [aRemettre, setARemettre] = useState<CommandeCarte | null>(null);
  const [aChoisir, setAChoisir] = useState<CommandeAScanner[] | null>(null);

  // Préchargement des emplacements pour la modale de re-placement.
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

  // Aiguillage sur l'action déduite par le serveur, appelé pour une candidate unique
  // comme depuis la pop-up de choix.
  async function executerAction(commande: CommandeAScanner) {
    if (commande.action === 'demarrer') {
      await demarrerRepassage(commande.id_commande);
      return; // le Kanban se rafraîchit via le socket commandes:maj
    }
    if (commande.action === 'recuperer') {
      // Confirmation obligatoire : « récupéré » est terminal, l'erreur ne se répare pas ici.
      setARemettre(commande);
      return;
    }
    setPanneau({ type: 'cloture', commande }); // enchaîne sur le placement ; rien n'est écrit avant « Terminer »
  }

  // Le champ est démonté pendant qu'un panneau est ouvert : le focus ne peut être posé
  // qu'après son remontage, donc dans un effet et non au moment du clic.
  useEffect(() => {
    if (panneau === null) champScan.current?.focus();
  }, [panneau]);

  // Un seul champ de scan : le serveur déduit l'action. Plusieurs candidates → la repasseuse choisit.
  async function scanner(e: FormEvent) {
    e.preventDefault();
    const valeur = code.trim();
    setCode('');
    if (!valeur) return;
    setMessage(null);
    try {
      const { commandes: candidates } = await resoudreScan(valeur);
      if (candidates.length === 1) {
        await executerAction(candidates[0]);
        return;
      }
      setAChoisir(candidates);
    } catch (err) {
      if (err instanceof ErreurApi && err.statut === 404) {
        setMessage('Aucune commande active pour ce client.');
      } else {
        setMessage('Erreur lors du scan.');
      }
    }
  }

  // Le clavier de l'atelier est le scanner : sans ce focus, le scan suivant partirait dans le vide.
  function fermerChoix() {
    setAChoisir(null);
    champScan.current?.focus();
  }

  // Écriture à la fin : la commande ne bascule qu'au « Terminer » du placement.
  async function terminerCloture(lignes: { id_emplacement: string; nombre_mannes: number }[]) {
    if (panneau?.type !== 'cloture') return;
    try {
      await cloturerRepassage(panneau.commande.id_commande, lignes);
      setPanneau(null);
    } catch (err) {
      setPanneau(null);
      setMessage(
        err instanceof ErreurApi && err.statut === 409
          ? "Cette commande n'est plus en cours."
          : 'Erreur lors de la clôture.'
      );
    }
  }

  // Ferme le panneau courant et rafraîchit le tableau derrière.
  function fermerPanneau() {
    setPanneau(null);
    queryClient.invalidateQueries({ queryKey: ['commandes'] });
  }

  async function confirmerRemise() {
    if (!aRemettre) return;
    const id = aRemettre.id_commande;
    setARemettre(null);
    try {
      await marquerRecuperee(id);
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
    } catch {
      setMessage('Erreur lors de la remise.');
    }
  }

  // Pause / reprise du timer (repasseuse) ; le Kanban se rafraîchit via le socket.
  function pause(c: CommandeCarte) { mettreEnPause(c.id_commande).catch(() => {}); }
  function reprendre(c: CommandeCarte) { reprendreRepassage(c.id_commande).catch(() => {}); }
  function cintres(c: CommandeCarte, nb: number) { definirCintresEntreprise(c.id_commande, nb).catch(() => {}); }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">Tableau des commandes</h1>

      {panneau === null && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            {estRepasseuse && (
              <form onSubmit={scanner} className="flex flex-col gap-1">
                <label htmlFor="scan-repassage" className="font-semibold">Scanner un client</label>
                <input
                  id="scan-repassage"
                  ref={champScan}
                  className="max-w-xs rounded border p-2"
                  placeholder="Scanner le client"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </form>
            )}
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 text-white"
              onClick={() => setPanneau({ type: 'reception' })}
            >
              + Nouvelle réception
            </button>
          </div>
          {estRepasseuse && (
            <button
              type="button"
              className="rounded border px-4 py-2"
              onClick={() => setPanneau({ type: 'reorganisation' })}
            >
              Réorganiser
            </button>
          )}
        </div>
      )}

      {message && <p className="text-red-700">{message}</p>}

      {panneau?.type === 'cloture' && (
        <div className="flex flex-col gap-2 rounded border p-3">
          <h2 className="font-semibold">Clôture : replacer les mannes</h2>
          <PlacementMannes
            nombreMannes={panneau.commande.nombre_mannes}
            emplacements={emplacements}
            idClient={panneau.commande.id_client}
            onTerminer={terminerCloture}
          />
          <button type="button" className="self-start underline" onClick={() => setPanneau(null)}>
            Annuler la clôture
          </button>
        </div>
      )}

      {panneau?.type === 'reception' && (
        <div className="flex flex-col gap-2 rounded border p-3">
          <ReceptionArrivee onFermer={fermerPanneau} />
        </div>
      )}

      {panneau?.type === 'reorganisation' && (
        <div className="flex flex-col gap-2 rounded border p-3">
          <ReorganisationEmplacements onFermer={fermerPanneau} />
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto">
        {COLONNES.map((col) => (
          <div key={col.statut} className="flex min-w-[12rem] flex-col gap-2">
            <h2 className="font-semibold">{col.titre}</h2>
            {commandes.filter((c) => c.statut === col.statut).map((c) => (
              <CarteCommande key={c.id_commande} commande={c} onModifier={setAModifier}
                onOuvrir={(commande) => setIdDetail(commande.id_commande)}
                onPause={estRepasseuse ? pause : undefined}
                onReprendre={estRepasseuse ? reprendre : undefined}
                onCintresEntreprise={estRepasseuse ? cintres : undefined} />
            ))}
          </div>
        ))}
      </div>

      {aChoisir && (
        <ModaleChoixCommande
          commandes={aChoisir}
          onChoisir={(c) => {
            fermerChoix();
            executerAction(c).catch(() => setMessage('Erreur lors du scan.'));
          }}
          onAnnuler={fermerChoix}
        />
      )}

      {aRemettre && (
        <ModaleConfirmation
          titre="Remise au client"
          message={`Remettre la commande de ${aRemettre.client_prenom} ${aRemettre.client_nom} ?`}
          libelleAction="Remettre"
          onConfirmer={confirmerRemise}
          onAnnuler={() => setARemettre(null)}
        />
      )}

      {detail && (
        <ModaleDetailCommande
          commande={detail}
          onFermer={() => setIdDetail(null)}
          onPause={estRepasseuse ? pause : undefined}
          onReprendre={estRepasseuse ? reprendre : undefined}
        />
      )}

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
