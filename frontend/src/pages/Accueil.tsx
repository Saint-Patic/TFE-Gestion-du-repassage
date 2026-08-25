import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Accueil() {
  const { utilisateur } = useAuth();
  const estGerante = utilisateur?.role === 'gerante';
  const estRepasseuse = utilisateur?.role === 'repasseuse';

  // Le Kanban est l'écran unique de la repasseuse : un menu à une seule entrée n'a pas d'objet.
  if (estRepasseuse) return <Navigate to="/tableau" replace />;

  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-bold">Accueil</h1>
      <p>Bienvenue. Choisissez une action.</p>
      <Link
        to="/tableau"
        className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
      >
        Tableau des commandes
      </Link>
      {estGerante && (
        <>
          <Link
            to="/clients/nouveau"
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
          >
            Créer un profil client
          </Link>
          <Link
            to="/clients"
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
          >
            Gérer les clients
          </Link>
          <Link
            to="/statistiques"
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
          >
            Statistiques
          </Link>
        </>
      )}
    </div>
  );
}
