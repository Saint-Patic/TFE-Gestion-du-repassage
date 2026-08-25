import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { rechercherClientParCodeBarre, creerCommande, placerEmplacements } from '../api/commandes';
import { listerEmplacements } from '../api/emplacements';
import { ErreurApi } from '../api/client';
import type { Client, Emplacement } from '../api/types';
import { PlacementMannes } from './PlacementMannes';
import { ChampNombre } from './ChampNombre';

type Phase = 'reception' | 'placement';

type Props = { onFermer: () => void };

export function ReceptionArrivee({ onFermer }: Props) {
  const [phase, setPhase] = useState<Phase>('reception');
  const [code, setCode] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [mannes, setMannes] = useState(1);
  const [prioritaire, setPrioritaire] = useState(false);
  const [cintresClient, setCintresClient] = useState(false);
  const [cintresEntrRendus, setCintresEntrRendus] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [emplacements, setEmplacements] = useState<Emplacement[]>([]);
  const [commande, setCommande] = useState<{ id_commande: string; nombre_mannes: number } | null>(null);
  const champScan = useRef<HTMLInputElement>(null);

  // Préchargement des emplacements (une fois) pour valider les scans côté client.
  useEffect(() => {
    listerEmplacements().then(setEmplacements).catch(() => {});
  }, []);

  // Auto-focus du champ scan client en phase réception.
  useEffect(() => {
    if (phase === 'reception' && !client) champScan.current?.focus();
  }, [phase, client]);

  // Le pavé tactile et le scanner doivent cohabiter : un appui sur un bouton y déplace le
  // focus, et le scan suivant — qui n'est qu'une frappe clavier — irait dans le vide.
  function compterMannes(n: number) {
    setMannes(n);
    champScan.current?.focus();
  }

  async function rechercher(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    const scanne = code.trim().toUpperCase();
    // Vidé systématiquement : sans cela, un second scan s'ajouterait au premier et
    // produirait un code invalide.
    setCode('');
    if (!scanne) return;

    // Rescanner le même client = une manne de plus, résolu sans appel serveur. Même geste
    // qu'au placement (#160), et surtout : aucune frappe requise, donc utilisable sur une
    // tablette où le scanner appairé masque le clavier logiciel (#340).
    if (client && scanne === client.code_barre.toUpperCase()) {
      setMannes((n) => n + 1);
      return;
    }

    try {
      const trouve = await rechercherClientParCodeBarre(scanne);
      setClient(trouve);
      setMannes(1); // le premier scan compte pour une manne
    } catch (err) {
      if (err instanceof ErreurApi && err.statut === 404) {
        setErreur('Client inconnu — créez-le d’abord.');
      } else {
        setErreur('Erreur lors de la recherche du client.');
      }
    }
  }

  async function validerReception(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    const nb = mannes;
    if (!Number.isInteger(nb) || nb < 1) {
      setErreur('Le nombre de mannes doit être un entier ≥ 1.');
      return;
    }
    setErreur(null);
    try {
      const cmd = await creerCommande({
        id_client: client.id_client,
        nombre_mannes: nb,
        prioritaire,
        cintres_client: cintresClient,
        cintres_entr_rendus: cintresEntrRendus,
      });
      setCommande({ id_commande: cmd.id_commande, nombre_mannes: cmd.nombre_mannes });
      setCode('');
      setPhase('placement');
    } catch {
      setErreur('Impossible d’enregistrer la réception.');
    }
  }

  async function terminerPlacement(lignes: { id_emplacement: string; nombre_mannes: number }[]) {
    if (!commande) return;
    setErreur(null);
    try {
      await placerEmplacements(commande.id_commande, lignes);
      onFermer();
    } catch {
      setErreur('Impossible d’enregistrer les emplacements.');
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <h2 className="text-lg font-semibold">Nouvelle réception</h2>

      {erreur && <p className="text-red-700">{erreur}</p>}

      {phase === 'reception' && (
        <>
          <form onSubmit={rechercher} className="flex flex-col gap-2">
            <label htmlFor="scan" className="font-semibold">Scanner le code-barres client</label>
            <input
              id="scan"
              ref={champScan}
              className="rounded border p-2"
              placeholder="Code-barres"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </form>

          <button type="button" className="self-start underline" onClick={onFermer}>
            Annuler
          </button>

          {client && (
            <form onSubmit={validerReception} className="flex flex-col gap-2 rounded border p-3">
              <p>Client : <strong>{client.prenom} {client.nom}</strong></p>
              <label htmlFor="mannes" className="font-semibold">Nombre de mannes</label>
              <ChampNombre
                id="mannes"
                libelle="nombre de mannes"
                valeur={mannes}
                min={1}
                onChange={compterMannes}
              />
              <p className="text-xs text-gray-500">
                Rescanner le client ajoute une manne — ou utilisez les boutons.
              </p>
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
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
                Valider la réception
              </button>
            </form>
          )}
        </>
      )}

      {phase === 'placement' && commande && (
        <PlacementMannes
          nombreMannes={commande.nombre_mannes}
          emplacements={emplacements}
          idClient={client?.id_client ?? ''}
          onTerminer={terminerPlacement}
        />
      )}
    </div>
  );
}
