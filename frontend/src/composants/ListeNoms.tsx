import type { Utilisateur } from '../api/types';

// Liste des utilisatrices : un bouton par nom.
// Utilisateur[] utilisatrices = "noms à proposer"
// function onSelection = "reçoit l'utilisatrice choisie"
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
          className="rounded-[0.6rem] border border-blue-600 bg-blue-100 px-[1.2rem] py-[0.9rem] text-[1.35rem]/[2.1rem] text-blue-700 hover:bg-blue-200"
        >
          {u.nom}
        </button>
      ))}
    </div>
  );
}
