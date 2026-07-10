// Fournisseur de jeton injecté par la couche auth (évite un couplage direct au stockage).
let fournisseurJeton: () => string | null = () => null;

export function definirFournisseurJeton(fn: () => string | null) {
  fournisseurJeton = fn;
}

export class ErreurApi extends Error {
  statut: number;
  corps: unknown;
  constructor(statut: number, corps: unknown) {
    super(`Erreur API ${statut}`);
    this.statut = statut;
    this.corps = corps;
  }
}

// Appel HTTP typé vers /api. Ajoute le Bearer, gère le JSON et le corps vide.
export async function requeteApi<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const jeton = fournisseurJeton();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (jeton) {
    headers['Authorization'] = `Bearer ${jeton}`;
  }

  const reponse = await fetch(`/api${chemin}`, { ...options, headers });

  if (reponse.status === 204) {
    return null as T;
  }

  const texte = await reponse.text();
  const corps = texte ? JSON.parse(texte) : null;

  if (!reponse.ok) {
    throw new ErreurApi(reponse.status, corps);
  }
  return corps as T;
}
