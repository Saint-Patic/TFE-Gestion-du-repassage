import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

// En-tête commun aux pages protégées.
export function AppShell({ children }: { children: ReactNode }) {
  const { utilisateur, deconnexion } = useAuth();
  return (
    // h-dvh et non h-screen : 100vh ignore les barres de Safari iOS et ferait déborder la page.
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between bg-blue-600 px-4 py-3 text-white">
        <span className="font-bold">La Manne à Bulles</span>
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
