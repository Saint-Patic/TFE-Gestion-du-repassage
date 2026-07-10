import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

// En-tête commun aux pages protégées.
export function AppShell({ children }: { children: ReactNode }) {
  const { utilisateur, deconnexion } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
        <span className="font-bold">La Manne à Bulles</span>
        <div className="flex items-center gap-3">
          <span>{utilisateur?.nom}</span>
          <button className="rounded bg-blue-800 px-3 py-1" onClick={deconnexion}>
            Déconnexion
          </button>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
