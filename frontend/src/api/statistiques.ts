import { requeteApi } from './client';

export type Indicateurs = {
  nbCommandes: number;
  tempsTotalS: number;
  totalMannes: number;
  moyenneParCommandeS: number;
  moyenneParManneS: number;
};

export type LigneRepasseuse = Indicateurs & {
  id_utilisateur: string | null;
  repasseuse: string | null;
};

export type StatistiquesPeriode = {
  debut: string;
  fin: string;
  global: Indicateurs;
  parRepasseuse: LigneRepasseuse[];
};

// Statistiques de temps de repassage sur une période (bornes incluses).
// Nom `chargerStatistiques` pour rester lisible à côté du composant `Statistiques`.
export function chargerStatistiques(debut: string, fin: string): Promise<StatistiquesPeriode> {
  return requeteApi<StatistiquesPeriode>(
    `/statistiques?debut=${encodeURIComponent(debut)}&fin=${encodeURIComponent(fin)}`
  );
}
