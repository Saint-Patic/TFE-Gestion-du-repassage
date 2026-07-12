import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../api/types';

// Garde de route : redirige vers l'accueil si le rôle n'est pas autorisé.
// À utiliser à l'intérieur de RouteProtegee (qui gère déjà l'authentification).
export function RouteRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { utilisateur } = useAuth();
  if (!utilisateur || !roles.includes(utilisateur.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
