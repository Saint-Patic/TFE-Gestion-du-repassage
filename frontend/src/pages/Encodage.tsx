import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { rechercherClientParCodeBarre, creerCommande, placerEmplacements } from '../api/commandes';
import { listerEmplacements } from '../api/emplacements';
import { ErreurApi } from '../api/client';
import type { Client, Emplacement } from '../api/types';
import { PlacementMannes } from '../composants/PlacementMannes';

type Phase = 'reception' | 'placement';

export function Encodage() {
  const [phase, setPhase] = useState<Phase>('reception');
  const [code, setCode] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [mannes, setMannes] = useState('1');
  const [prioritaire, setPrioritaire] = useState(false);
  const [cintresClient, setCintresClient] = useState(false);
  const [cintresEntrRendus, setCintresEntrRendus] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [emplacements, setEmplacements] = useState<Emplacement[]>([]);
  const [commande, setCommande] = useState<{ id_commande: string; nombre_mannes: number } | null>(null);
  const champScan = useRef<HTMLInputElement>(null);

  // Préchargement des 42 emplacements (une fois) pour valider les scans côté client.
  useEffect(() => {
    listerEmplacements().then(setEmplacements).catch(() => {});
  }, []);

  // Auto-focus du champ scan client en phase réception.
  useEffect(() => {
    if (phase === 'reception' && !client) champScan.current?.focus();
  }, [phase, client]);

  async function rechercher(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setSucces(null);
    try {
      const trouve = await rechercherClientParCodeBarre(code.trim());
      setClient(trouve);
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
    const nb = Number(mannes);
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
      setSucces(
        `Réception localisée : ${client?.prenom} ${client?.nom} — ${commande.nombre_mannes} manne(s).`
      );
      // Réinitialisation complète vers la réception.
      setPhase('reception');
      setCommande(null);
      setClient(null);
      setCode('');
      setMannes('1');
      setPrioritaire(false);
      setCintresClient(false);
      setCintresEntrRendus(false);
    } catch {
      setErreur('Impossible d’enregistrer les emplacements.');
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <h1 className="text-xl font-bold">Encodage / Réception</h1>

      {succes && <p className="text-green-700">{succes}</p>}
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

          {client && (
            <form onSubmit={validerReception} className="flex flex-col gap-2 rounded border p-3">
              <p>Client : <strong>{client.prenom} {client.nom}</strong></p>
              <label htmlFor="mannes" className="font-semibold">Nombre de mannes</label>
              <input
                id="mannes"
                className="rounded border p-2"
                type="number"
                min={1}
                value={mannes}
                onChange={(e) => setMannes(e.target.value)}
              />
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
