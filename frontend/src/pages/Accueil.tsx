import { Link } from 'react-router-dom';

export function Accueil() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-bold">Accueil</h1>
      <p>Bienvenue. Choisissez une action.</p>
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
    </div>
  );
}
