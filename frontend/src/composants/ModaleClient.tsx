import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Client, NouveauClient } from '../api/types';

type Props = {
  client: Client;
  onEnregistrer: (donnees: NouveauClient) => void;
  onAnnuler: () => void;
};

// Modale d'édition d'un client (le code_barre n'est pas modifiable).
export function ModaleClient({ client, onEnregistrer, onAnnuler }: Props) {
  const [nom, setNom] = useState(client.nom);
  const [prenom, setPrenom] = useState(client.prenom);
  const [telephone, setTelephone] = useState(client.telephone);
  const [email, setEmail] = useState(client.email ?? '');

  function soumettre(e: FormEvent) {
    e.preventDefault();
    onEnregistrer({ nom, prenom, telephone, email: email || undefined });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={soumettre}
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-4 shadow-lg"
      >
        <h2 className="text-lg font-bold">Modifier le client</h2>
        <input className="rounded border p-2" placeholder="Nom" value={nom}
          onChange={(e) => setNom(e.target.value)} required />
        <input className="rounded border p-2" placeholder="Prénom" value={prenom}
          onChange={(e) => setPrenom(e.target.value)} required />
        <input className="rounded border p-2" placeholder="Téléphone" value={telephone}
          onChange={(e) => setTelephone(e.target.value)} required />
        <input className="rounded border p-2" placeholder="Email (optionnel)" type="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded px-4 py-2" onClick={onAnnuler}>Annuler</button>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}
