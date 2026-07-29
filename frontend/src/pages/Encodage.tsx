import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { rechercherClientParCodeBarre, creerCommande } from '../api/commandes';
import { ErreurApi } from '../api/client';
import type { Client } from '../api/types';

export function Encodage() {
  const [code, setCode] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [mannes, setMannes] = useState('1');
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const champScan = useRef<HTMLInputElement>(null);

  // Auto-focus du champ scan à l'arrivée et après chaque réinitialisation.
  useEffect(() => {
    if (!client) champScan.current?.focus();
  }, [client]);

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

  async function valider(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    const nb = Number(mannes);
    if (!Number.isInteger(nb) || nb < 1) {
      setErreur('Le nombre de mannes doit être un entier ≥ 1.');
      return;
    }
    setErreur(null);
    try {
      await creerCommande({ id_client: client.id_client, nombre_mannes: nb });
      setSucces(`Réception enregistrée : ${client.prenom} ${client.nom} — ${nb} manne(s).`);
      setClient(null);
      setCode('');
      setMannes('1');
    } catch {
      setErreur('Impossible d’enregistrer la réception.');
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <h1 className="text-xl font-bold">Encodage / Réception</h1>

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

      {succes && <p className="text-green-700">{succes}</p>}
      {erreur && <p className="text-red-700">{erreur}</p>}

      {client && (
        <form onSubmit={valider} className="flex flex-col gap-2 rounded border p-3">
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
    </div>
  );
}
