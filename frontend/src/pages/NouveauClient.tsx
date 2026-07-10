import { useState } from 'react';
import type { FormEvent } from 'react';
import { creerClient } from '../api/clients';
import { imprimerEtiquette } from '../api/agent';
import type { Client } from '../api/types';

type EtatImpression = 'idle' | 'encours' | 'imprime' | 'erreur';

export function NouveauClient() {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [impression, setImpression] = useState<EtatImpression>('idle');

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    try {
      const cree = await creerClient({ nom, prenom, telephone, email: email || undefined });
      setClient(cree);
    } catch {
      setErreur('Impossible de créer le client.');
    }
  }

  async function imprimer() {
    if (!client) return;
    setImpression('encours');
    try {
      await imprimerEtiquette(client);
      setImpression('imprime');
    } catch {
      setImpression('erreur');
    }
  }

  if (client) {
    return (
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-xl font-bold">Client créé</h1>
        <p>{client.prenom} {client.nom}</p>
        <p>Code-barres : <strong>{client.code_barre}</strong></p>
        <button
          className="mt-2 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          onClick={imprimer}
          disabled={impression === 'encours'}
        >
          {impression === 'encours' ? 'Impression…' : "Imprimer l'étiquette"}
        </button>
        {impression === 'imprime' && <p className="text-green-700">Étiquette imprimée.</p>}
        {impression === 'erreur' && (
          <p className="text-red-700">Agent d'impression injoignable. Réessayez.</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={soumettre} className="flex max-w-sm flex-col gap-3">
      <h1 className="text-xl font-bold">Nouveau client</h1>
      <input className="rounded border p-2" placeholder="Nom" value={nom}
        onChange={(e) => setNom(e.target.value)} required />
      <input className="rounded border p-2" placeholder="Prénom" value={prenom}
        onChange={(e) => setPrenom(e.target.value)} required />
      <input className="rounded border p-2" placeholder="Téléphone" value={telephone}
        onChange={(e) => setTelephone(e.target.value)} required />
      <input className="rounded border p-2" placeholder="Email (optionnel)" type="email"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      {erreur && <p className="text-red-700">{erreur}</p>}
      <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">Créer</button>
    </form>
  );
}
