import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// string CLASSE_BOUTON = "style commun aux quatre entrées du menu"
const CLASSE_BOUTON =
  'flex min-h-32 items-center justify-center rounded-lg bg-blue-600 p-6 text-center text-xl font-semibold text-white';

// Menu de la gérante : quatre entrées en grille 2 × 2, centrée dans la page.
export function Accueil() {
  // Utilisateur|null utilisateur = "utilisatrice connectée"
  const { utilisateur } = useAuth();
  // boolean estGerante = "seule la gérante voit les clients et les statistiques"
  const estGerante = utilisateur?.role === 'gerante';
  // boolean estRepasseuse = "le Kanban est son écran unique, elle n'a pas de menu"
  const estRepasseuse = utilisateur?.role === 'repasseuse';

  if (estRepasseuse) return <Navigate to="/tableau" replace />;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="grid w-full max-w-2xl grid-cols-2 gap-4">
        <Link to="/tableau" className={CLASSE_BOUTON}>
          Tableau des commandes
        </Link>
        {estGerante && (
          <>
            <Link to="/clients/nouveau" className={CLASSE_BOUTON}>
              Créer un profil client
            </Link>
            <Link to="/clients" className={CLASSE_BOUTON}>
              Gérer les clients
            </Link>
            <Link to="/statistiques" className={CLASSE_BOUTON}>
              Statistiques
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
