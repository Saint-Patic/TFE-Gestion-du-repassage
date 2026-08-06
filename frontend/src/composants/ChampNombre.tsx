import { useEffect, useState } from 'react';

type Props = {
  id?: string;
  /** Sert aux libellés d'accessibilité des deux boutons (« Augmenter <libelle> »). */
  libelle: string;
  valeur: number;
  onChange: (valeur: number) => void;
  min?: number;
  max?: number;
};

// Saisie d'un nombre SANS clavier logiciel.
//
// Sur les tablettes de l'atelier, le scanner NETUM est appairé en Bluetooth : le système
// considère qu'un clavier matériel est branché et masque donc le clavier à l'écran. Aucune
// API web ne permet de le rappeler, et iPadOS n'offre même pas de réglage pour le forcer.
// Les deux boutons rendent la saisie possible partout, sans configuration système ni
// détection d'appareil — même parti pris que le pavé numérique du PIN (#70).
//
// Le champ reste éditable au clavier pour le poste de la gérante : la saisie est conservée
// dans un état de texte à part, ce qui autorise le passage transitoire par un champ vide
// entre deux frappes sans que la valeur ne saute à la borne minimale.
export function ChampNombre({ id, libelle, valeur, onChange, min = 0, max }: Props) {
  const [saisie, setSaisie] = useState(String(valeur));

  // La valeur peut changer sans passer par le clavier : boutons, rescan du code-barres,
  // ou rafraîchissement depuis le serveur.
  useEffect(() => {
    setSaisie(String(valeur));
  }, [valeur]);

  function borner(n: number) {
    if (!Number.isFinite(n)) return min;
    if (n < min) return min;
    if (max !== undefined && n > max) return max;
    return n;
  }

  function surSaisie(texte: string) {
    setSaisie(texte);
    if (texte === '') return; // champ vidé le temps de retaper : on n'émet rien
    const n = Math.trunc(Number(texte));
    if (Number.isFinite(n)) onChange(borner(n));
  }

  const classeBouton = 'rounded border px-3 py-2 text-lg leading-none disabled:opacity-40';

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Diminuer ${libelle}`}
        className={classeBouton}
        disabled={valeur <= min}
        onClick={() => onChange(borner(valeur - 1))}
      >
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={saisie}
        className="w-16 rounded border p-2 text-center"
        onChange={(e) => surSaisie(e.target.value)}
      />
      <button
        type="button"
        aria-label={`Augmenter ${libelle}`}
        className={classeBouton}
        disabled={max !== undefined && valeur >= max}
        onClick={() => onChange(borner(valeur + 1))}
      >
        +
      </button>
    </span>
  );
}
