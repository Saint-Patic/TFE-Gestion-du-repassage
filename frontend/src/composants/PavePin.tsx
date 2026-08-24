import { useCallback, useEffect, useState } from 'react';

// Le clavier physique n'est écouté que sur un appareil à pointeur précis, c'est-à-dire un
// ordinateur : sur tablette, le scanner NETUM est un clavier HID et composerait le PIN seul.
function clavierUtilisable() {
  return window.matchMedia?.('(pointer: fine)').matches ?? false;
}

// Pavé numérique : accumule 4 chiffres puis appelle onComplet(pin).
export function PavePin({ onComplet }: { onComplet: (pin: string) => void }) {
  const [saisie, setSaisie] = useState('');

  const effacer = useCallback(() => setSaisie((s) => s.slice(0, -1)), []);

  const ajouter = useCallback(
    (chiffre: string) => {
      if (saisie.length >= 4) return;
      const suivant = saisie + chiffre;
      setSaisie(suivant);
      if (suivant.length === 4) {
        onComplet(suivant);
        setSaisie('');
      }
    },
    [saisie, onComplet]
  );

  // `ajouter` change avec la saisie : l'écouteur est réenregistré et voit donc toujours la
  // valeur courante. Sans cette dépendance, seul le premier chiffre serait pris en compte.
  useEffect(() => {
    if (!clavierUtilisable()) return;
    function surTouche(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) {
        ajouter(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        effacer();
      }
    }
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [ajouter, effacer]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-2xl tracking-widest">
        {'•'.repeat(saisie.length)}{'_'.repeat(4 - saisie.length)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => ajouter(c)}
            className="h-16 w-16 rounded-full bg-blue-600 text-2xl text-white active:bg-blue-800"
          >
            {c}
          </button>
        ))}
        {/* Case vide : place le 0 au centre, comme sur un clavier téléphonique. */}
        <span />
        <button
          type="button"
          onClick={() => ajouter('0')}
          className="h-16 w-16 rounded-full bg-blue-600 text-2xl text-white active:bg-blue-800"
        >
          0
        </button>
        <button
          type="button"
          aria-label="Effacer"
          onClick={effacer}
          disabled={saisie.length === 0}
          className="h-16 w-16 rounded-full border text-2xl active:bg-gray-200 disabled:opacity-40"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
