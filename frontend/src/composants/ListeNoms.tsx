import type { Utilisateur } from '../api/types';

// Liste des utilisatrices : un bouton par nom.
export function ListeNoms({
  utilisatrices,
  onSelection,
}: {
  utilisatrices: Utilisateur[];
  onSelection: (u: Utilisateur) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {utilisatrices.map((u) => (
        <button
          key={u.id_utilisateur}
          type="button"
          onClick={() => onSelection(u)}
          className="rounded-lg border border-gray-300 px-4 py-3 text-lg hover:bg-gray-100"
        >
          {u.nom}
        </button>
      ))}
    </div>
  );
}
