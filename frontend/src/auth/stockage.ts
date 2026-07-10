import type { Utilisateur } from '../api/types';

const CLE_JETON = 'jeton_session';
const CLE_UTILISATEUR = 'utilisateur_session';

export function lireJeton(): string | null {
  return sessionStorage.getItem(CLE_JETON);
}
export function ecrireJeton(jeton: string): void {
  sessionStorage.setItem(CLE_JETON, jeton);
}
export function effacerJeton(): void {
  sessionStorage.removeItem(CLE_JETON);
  sessionStorage.removeItem(CLE_UTILISATEUR);
}
export function lireUtilisateur(): Utilisateur | null {
  const brut = sessionStorage.getItem(CLE_UTILISATEUR);
  return brut ? (JSON.parse(brut) as Utilisateur) : null;
}
export function ecrireUtilisateur(utilisateur: Utilisateur): void {
  sessionStorage.setItem(CLE_UTILISATEUR, JSON.stringify(utilisateur));
}
