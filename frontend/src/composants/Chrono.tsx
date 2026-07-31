import { useEffect, useState } from 'react';

// Formate un nombre de secondes en HH:MM:SS (avec padding).
export function formaterHMS(totalSecondes: number): string {
  const s = Math.max(0, Math.floor(totalSecondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

type Props = { debut?: string | null; cumul?: number };

// Chrono H:M:S = temps cumulé (hors pauses, futur #225) + segment en cours (maintenant − début).
// S'incrémente chaque seconde tant que `debut` est défini.
export function Chrono({ debut, cumul = 0 }: Props) {
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    if (!debut) return;
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, [debut]);

  const segment = debut ? Math.floor((maintenant - new Date(debut).getTime()) / 1000) : 0;
  return <span className="font-mono tabular-nums">{formaterHMS(cumul + segment)}</span>;
}
