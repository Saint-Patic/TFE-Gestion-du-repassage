import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { rechercherClientParCodeBarre, creerCommande, placerEmplacements } from '../api/commandes';
import { listerEmplacements } from '../api/emplacements';
import { ErreurApi } from '../api/client';
import type { Client, Emplacement } from '../api/types';

type Phase = 'reception' | 'placement';

export function Encodage() {
  const [phase, setPhase] = useState<Phase>('reception');
  const [code, setCode] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [mannes, setMannes] = useState('1');
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  // Phase placement.
  const [emplacements, setEmplacements] = useState<Emplacement[]>([]);
  const [commande, setCommande] = useState<{ id_commande: string; nombre_mannes: number } | null>(null);
  const [scans, setScans] = useState<Emplacement[]>([]); // pile ordonnée : un élément par manne
  const champScan = useRef<HTMLInputElement>(null);
  const champPlacement = useRef<HTMLInputElement>(null);

  // Préchargement des 42 emplacements (une fois) pour valider les scans côté client.
  useEffect(() => {
    listerEmplacements().then(setEmplacements).catch(() => {});
  }, []);

  // Auto-focus selon la phase.
  useEffect(() => {
    if (phase === 'reception' && !client) champScan.current?.focus();
    if (phase === 'placement') champPlacement.current?.focus();
  }, [phase, client]);

  const reste = commande ? commande.nombre_mannes - scans.length : 0;

  // Agrège la pile de scans en lignes { emplacement, nombre_mannes }.
  const lignes = useMemo(() => {
    const compte = new Map<string, { emp: Emplacement; n: number }>();
    for (const emp of scans) {
      const existant = compte.get(emp.id_emplacement) || { emp, n: 0 };
      existant.n += 1;
      compte.set(emp.id_emplacement, existant);
    }
    return [...compte.values()];
  }, [scans]);

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
      const cmd = await creerCommande({ id_client: client.id_client, nombre_mannes: nb });
      setCommande({ id_commande: cmd.id_commande, nombre_mannes: cmd.nombre_mannes });
      setScans([]);
      setCode('');
      setPhase('placement');
    } catch {
      setErreur('Impossible d’enregistrer la réception.');
    }
  }

  function scannerEmplacement(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    const valeur = code.trim();
    setCode('');
    if (reste <= 0) {
      setErreur('Toutes les mannes sont placées.');
      return;
    }
    const emp = emplacements.find((x) => x.code_barre === valeur);
    if (!emp) {
      setErreur('Emplacement inconnu.');
      return;
    }
    setScans((s) => [...s, emp]);
  }

  function annulerDernier() {
    setErreur(null);
    setScans((s) => s.slice(0, -1));
  }

  async function terminer() {
    if (!commande || reste !== 0) return;
    setErreur(null);
    try {
      await placerEmplacements(
        commande.id_commande,
        lignes.map((l) => ({ id_emplacement: l.emp.id_emplacement, nombre_mannes: l.n }))
      );
      setSucces(
        `Réception localisée : ${client?.prenom} ${client?.nom} — ${commande.nombre_mannes} manne(s).`
      );
      // Réinitialisation complète vers la réception.
      setPhase('reception');
      setCommande(null);
      setScans([]);
      setClient(null);
      setCode('');
      setMannes('1');
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
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
                Valider la réception
              </button>
            </form>
          )}
        </>
      )}

      {phase === 'placement' && commande && (
        <div className="flex flex-col gap-3 rounded border p-3">
          <p className="font-semibold">
            Placer les {commande.nombre_mannes} mannes — reste {reste}
          </p>

          <form onSubmit={scannerEmplacement} className="flex flex-col gap-2">
            <label htmlFor="placement" className="font-semibold">Scanner l’emplacement</label>
            <input
              id="placement"
              ref={champPlacement}
              className="rounded border p-2"
              placeholder="Code emplacement"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </form>

          {lignes.length > 0 && (
            <ul className="flex flex-col gap-1">
              {lignes.map((l) => (
                <li key={l.emp.id_emplacement}>
                  {l.emp.code_barre} ×{l.n}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={annulerDernier}
              disabled={scans.length === 0}
              className="rounded border px-3 py-2 disabled:opacity-50"
            >
              Annuler le dernier scan
            </button>
            <button
              type="button"
              onClick={terminer}
              disabled={reste !== 0}
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Terminer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
