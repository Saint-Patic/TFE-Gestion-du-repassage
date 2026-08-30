import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import logoBlanc from '../assets/logo-blanc.png';

// En-tête commun aux pages protégées.
// ReactNode children = "contenu de la page, affiché sous l'en-tête"
export function AppShell({ children }: { children: ReactNode }) {
  // Utilisateur|null utilisateur = "utilisatrice connectée"
  // function deconnexion = "ferme la session"
  const { utilisateur, deconnexion } = useAuth();
  // boolean estRepasseuse = "son accueil redirige vers le Kanban : le logo recharge au lieu de naviguer"
  const estRepasseuse = utilisateur?.role === 'repasseuse';
  // JSX logo = "image du logo, partagée par les deux comportements du clic"
  const logo = <img src={logoBlanc} alt="La Manne à Bulles" className="h-7 w-auto" />;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between bg-blue-600 px-4 py-3 text-white">
        {estRepasseuse ? (
          <button type="button" title="Rafraîchir la page" onClick={() => window.location.reload()}>
            {logo}
          </button>
        ) : (
          <Link to="/" title="Retour à l'accueil">
            {logo}
          </Link>
        )}
        <div className="flex items-center gap-3">
          <span>{utilisateur?.nom}</span>
          <button className="rounded bg-blue-800 px-3 py-1" onClick={deconnexion}>
            Déconnexion
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}
