import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Emplacement } from '../api/types';

type Ligne = { id_emplacement: string; nombre_mannes: number };

type Props = {
  nombreMannes: number;
  emplacements: Emplacement[];
  onTerminer: (lignes: Ligne[]) => void | Promise<void>;
};

// Phase de placement : 1 scan = 1 manne, empilement, jusqu'à « reste 0 ».
// Aucun appel réseau : remonte la répartition agrégée via onTerminer.
export function PlacementMannes({ nombreMannes, emplacements, onTerminer }: Props) {
  const [code, setCode] = useState('');
  const [scans, setScans] = useState<Emplacement[]>([]); // pile ordonnée : un élément par manne
  const [erreur, setErreur] = useState<string | null>(null);
  const champScan = useRef<HTMLInputElement>(null);

  useEffect(() => {
    champScan.current?.focus();
  }, []);

  const reste = nombreMannes - scans.length;

  const lignes = useMemo(() => {
    const compte = new Map<string, { emp: Emplacement; n: number }>();
    for (const emp of scans) {
      const existant = compte.get(emp.id_emplacement) || { emp, n: 0 };
      existant.n += 1;
      compte.set(emp.id_emplacement, existant);
    }
    return [...compte.values()];
  }, [scans]);

  function scanner(e: FormEvent) {
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

  function terminer() {
    if (reste !== 0) return;
    onTerminer(lignes.map((l) => ({ id_emplacement: l.emp.id_emplacement, nombre_mannes: l.n })));
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-3">
      <p className="font-semibold">Placer les {nombreMannes} mannes — reste {reste}</p>
      {erreur && <p className="text-red-700">{erreur}</p>}

      <form onSubmit={scanner} className="flex flex-col gap-2">
        <label htmlFor="placement" className="font-semibold">Scanner l’emplacement</label>
        <input
          id="placement"
          ref={champScan}
          className="rounded border p-2"
          placeholder="Code emplacement"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </form>

      {lignes.length > 0 && (
        <ul className="flex flex-col gap-1">
          {lignes.map((l) => (
            <li key={l.emp.id_emplacement}>{l.emp.code_barre} ×{l.n}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={annulerDernier} disabled={scans.length === 0}
          className="rounded border px-3 py-2 disabled:opacity-50">
          Annuler le dernier scan
        </button>
        <button type="button" onClick={terminer} disabled={reste !== 0}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          Terminer
        </button>
      </div>
    </div>
  );
}
