import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { listerEmplacements, contenuEmplacement, deplacerEmplacement } from '../api/emplacements';
import { ErreurApi } from '../api/client';
import type { Emplacement, ContenuEmplacement } from '../api/types';

type Phase = 'source' | 'destination';
type ClientLot = { id_client: string; client_nom: string; client_prenom: string };

function etiquette(emp: Emplacement) {
  return emp.est_au_sol ? 'Au sol' : emp.code_barre;
}

export function Reorganisation() {
  const [emplacements, setEmplacements] = useState<Emplacement[]>([]);
  const [phase, setPhase] = useState<Phase>('source');
  const [source, setSource] = useState<Emplacement | null>(null);
  const [contenu, setContenu] = useState<ContenuEmplacement[]>([]);
  const [client, setClient] = useState<ClientLot | null>(null);
  const [destination, setDestination] = useState<Emplacement | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listerEmplacements().then(setEmplacements).catch(() => {});
  }, []);

  useEffect(() => {
    champ.current?.focus();
  }, [phase]);

  function reinitialiser() {
    setPhase('source');
    setSource(null);
    setContenu([]);
    setClient(null);
    setDestination(null);
    setCode('');
    setErreur(null);
  }

  const clientsDuSol: ClientLot[] = [
    ...new Map(
      contenu.map((c) => [
        c.id_client,
        { id_client: c.id_client, client_nom: c.client_nom, client_prenom: c.client_prenom },
      ])
    ).values(),
  ];

  async function ouvrirSource(emp: Emplacement) {
    setErreur(null);
    setSucces(null);
    try {
      const lignes = await contenuEmplacement(emp.id_emplacement);
      if (lignes.length === 0) {
        setErreur('Cet emplacement est vide.');
        return;
      }
      setSource(emp);
      setContenu(lignes);
      if (!emp.est_au_sol) {
        const l = lignes[0];
        setClient({ id_client: l.id_client, client_nom: l.client_nom, client_prenom: l.client_prenom });
        setPhase('destination');
      }
      // sol : on attend le choix du client (liste affichée), phase reste 'source'
    } catch {
      setErreur('Erreur lors de la lecture de l’emplacement.');
    }
  }

  function scannerSource(e: FormEvent) {
    e.preventDefault();
    const emp = emplacements.find((x) => x.code_barre === code.trim());
    setCode('');
    if (!emp) {
      setErreur('Emplacement inconnu.');
      return;
    }
    ouvrirSource(emp);
  }

  function sourceAuSol() {
    const sol = emplacements.find((x) => x.est_au_sol);
    if (!sol) {
      setErreur('Emplacement « Au sol » indisponible.');
      return;
    }
    ouvrirSource(sol);
  }

  function choisirClient(c: ClientLot) {
    setClient(c);
    setPhase('destination');
  }

  function choisirDestination(emp: Emplacement) {
    setErreur(null);
    if (source && emp.id_emplacement === source.id_emplacement) {
      setErreur('Source et destination identiques.');
      return;
    }
    if (!emp.est_au_sol && emp.id_client_occupant && client && emp.id_client_occupant !== client.id_client) {
      setDestination(null);
      setErreur('Destination occupée par les mannes d’un autre client.');
      return;
    }
    setDestination(emp);
  }

  function scannerDestination(e: FormEvent) {
    e.preventDefault();
    const emp = emplacements.find((x) => x.code_barre === code.trim());
    setCode('');
    if (!emp) {
      setErreur('Emplacement inconnu.');
      return;
    }
    choisirDestination(emp);
  }

  function destinationAuSol() {
    const sol = emplacements.find((x) => x.est_au_sol);
    if (!sol) {
      setErreur('Emplacement « Au sol » indisponible.');
      return;
    }
    choisirDestination(sol);
  }

  async function deplacer() {
    if (!source || !destination || !client) return;
    setErreur(null);
    try {
      await deplacerEmplacement(source.id_emplacement, destination.id_emplacement, client.id_client);
      const total = contenu
        .filter((c) => c.id_client === client.id_client)
        .reduce((s, c) => s + c.nombre_mannes, 0);
      setSucces(
        `${total} manne(s) de ${client.client_prenom} ${client.client_nom} déplacée(s) de ${etiquette(source)} vers ${etiquette(destination)}.`
      );
      reinitialiser();
    } catch (err) {
      if (err instanceof ErreurApi && err.statut === 409) {
        setErreur('Destination occupée par les mannes d’un autre client.');
      } else {
        setErreur('Impossible de déplacer les mannes.');
      }
    }
  }

  const nomClient = client ? `${client.client_prenom} ${client.client_nom}` : '';

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <h1 className="text-xl font-bold">Réorganiser les emplacements</h1>
      {succes && <p className="text-green-700">{succes}</p>}
      {erreur && <p className="text-red-700">{erreur}</p>}

      {phase === 'source' && (
        <div className="flex flex-col gap-3">
          <form onSubmit={scannerSource} className="flex flex-col gap-2">
            <label htmlFor="src" className="font-semibold">Scanner l’emplacement source</label>
            <input id="src" ref={champ} className="rounded border p-2" placeholder="Code emplacement"
              value={code} onChange={(e) => setCode(e.target.value)} />
          </form>
          <button type="button" onClick={sourceAuSol} className="self-start rounded border px-3 py-2">
            Depuis le sol
          </button>

          {source?.est_au_sol && contenu.length > 0 && (
            <div className="flex flex-col gap-2 rounded border p-3">
              <p className="font-semibold">Sol — choisir le client à sortir :</p>
              {clientsDuSol.map((c) => (
                <button key={c.id_client} type="button" onClick={() => choisirClient(c)}
                  className="self-start rounded border px-3 py-1">
                  {c.client_prenom} {c.client_nom}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'destination' && source && client && (
        <div className="flex flex-col gap-3">
          <p>Déplacer les mannes de <strong>{nomClient}</strong> depuis <strong>{etiquette(source)}</strong>.</p>
          <form onSubmit={scannerDestination} className="flex flex-col gap-2">
            <label htmlFor="dst" className="font-semibold">Scanner l’emplacement destination</label>
            <input id="dst" ref={champ} className="rounded border p-2" placeholder="Code emplacement"
              value={code} onChange={(e) => setCode(e.target.value)} />
          </form>
          <button type="button" onClick={destinationAuSol} className="self-start rounded border px-3 py-2">
            Vers le sol
          </button>

          {destination && (
            <button type="button" onClick={deplacer}
              className="self-start rounded bg-blue-600 px-4 py-2 text-white">
              Déplacer vers {etiquette(destination)}
            </button>
          )}
          <button type="button" onClick={reinitialiser} className="self-start rounded border px-3 py-2">
            Recommencer
          </button>
        </div>
      )}
    </div>
  );
}
