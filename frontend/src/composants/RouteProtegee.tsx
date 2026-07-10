import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppShell } from './AppShell';

// Garde : redirige vers /connexion si pas de session (après la phase de chargement).
export function RouteProtegee({ children }: { children: ReactNode }) {
  const { utilisateur, chargement } = useAuth();
  if (chargement) return <p className="p-4">Chargement…</p>;
  if (!utilisateur) return <Navigate to="/connexion" replace />;
  return <AppShell>{children}</AppShell>;
}
