type Props = {
  titre: string;
  message: string;
  libelleAction?: string;
  onConfirmer: () => void;
  onAnnuler: () => void;
};

// Modale de confirmation générique (action destructive → bouton rouge).
export function ModaleConfirmation({
  titre,
  message,
  libelleAction = 'Confirmer',
  onConfirmer,
  onAnnuler,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
        <h2 className="text-lg font-bold">{titre}</h2>
        <p className="mt-2 text-sm">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded px-4 py-2" onClick={onAnnuler}>
            Annuler
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-4 py-2 text-white"
            onClick={onConfirmer}
          >
            {libelleAction}
          </button>
        </div>
      </div>
    </div>
  );
}
