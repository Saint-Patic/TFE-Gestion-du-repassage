import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Accueil() {
  const { utilisateur } = useAuth();
  const estGerante = utilisateur?.role === 'gerante';
  const estRepasseuse = utilisateur?.role === 'repasseuse';

  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-bold">Accueil</h1>
      <p>Bienvenue. Choisissez une action.</p>
      <Link
        to="/encodage"
        className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
      >
        Encodage / Réception
      </Link>
      <Link
        to="/tableau"
        className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
      >
        Tableau des commandes
      </Link>
      {estRepasseuse && (
        <Link
          to="/reorganisation"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
        >
          Réorganiser les emplacements
        </Link>
      )}
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
