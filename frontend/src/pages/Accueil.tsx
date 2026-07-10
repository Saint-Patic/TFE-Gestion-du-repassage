import { Link } from 'react-router-dom';

export function Accueil() {
  return (
    <div>
      <h1 className="text-xl font-bold">Accueil</h1>
      <p>Bienvenue. Choisissez une action.</p>
      <Link
        to="/clients/nouveau"
        className="mt-3 inline-block rounded bg-blue-600 px-4 py-2 text-white"
      >
        Créer un profil client
      </Link>
    </div>
  );
}
