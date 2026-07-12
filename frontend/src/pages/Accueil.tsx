import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Accueil() {
  const { utilisateur } = useAuth();
  const estGerante = utilisateur?.role === 'gerante';

  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-bold">Accueil</h1>
      <p>Bienvenue. Choisissez une action.</p>
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
        </>
      )}
    </div>
  );
}
